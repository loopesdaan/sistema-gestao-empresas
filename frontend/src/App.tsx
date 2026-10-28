import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { PDV } from './pages/PDV';
import { Caixa } from './pages/Caixa';
import { Produtos } from './pages/Produtos';
import { Clientes } from './pages/Clientes';
import { OS } from './pages/OS';
import { Relatorios } from './pages/Relatorios';
import { Empresa } from './pages/Empresa';
import { Usuarios } from './pages/Usuarios';
import { Ponto } from './pages/Ponto';
import { Notificacoes } from './pages/Notificacoes';
import { Onboarding } from './pages/Onboarding';
import { Financeiro } from './pages/Financeiro';
// import { ChatbotIA } from './components/ChatbotIA';
import { TourModal } from './components/TourModal';
import { MeuPerfilModal } from './components/MeuPerfilModal';
import { apiService } from './services/api';
import { Usuario, Caixa as CaixaType, StatusJornada } from './types';
import { Clock } from 'lucide-react';
import { NotificationProvider } from './contexts/NotificationContext';
import { EmpresaProvider, useEmpresa } from './contexts/EmpresaContext';
import { ToastProvider } from './contexts/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Componente interno que usa os contextos
const AppContent: React.FC = () => {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const salvo = localStorage.getItem('gestao_user') || sessionStorage.getItem('gestao_user');
    return salvo ? JSON.parse(salvo) : null;
  });

  const isAdmin = usuario?.perfil === 'ADMIN';
  const isFinanceiro = usuario?.perfil === 'FINANCEIRO';
  const isAdminOuFinanceiro = isAdmin || isFinanceiro;
  const isEstoquista = usuario?.perfil === 'ESTOQUISTA';
  const { modulosAtivos, carregarDadosEmpresa } = useEmpresa();

  const [activeTab, setActiveTab] = useState(() => {
    const salvo = localStorage.getItem('gestao_user') || sessionStorage.getItem('gestao_user');
    const u = salvo ? JSON.parse(salvo) : null;
    if (u?.perfil === 'ADMIN') return 'dashboard';
    if (u?.perfil === 'FINANCEIRO') return 'financeiro';
    if (u?.perfil === 'ESTOQUISTA') return 'produtos';
    return 'pdv';
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('gestao_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('gestao_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };
  const [caixaAberto, setCaixaAberto] = useState(false);
  const [caixaAtual, setCaixaAtual] = useState<CaixaType | null>(null);
  const [statusPonto, setStatusPonto] = useState<StatusJornada | null>(null);
  // Controla exibição do wizard de onboarding inicial
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showPerfilModal, setShowPerfilModal] = useState(false);

  // Sincroniza dados da empresa e verifica onboarding assim que o usuário loga ou entra na página
  useEffect(() => {
    if (usuario) {
      carregarDadosEmpresa();
    }
    if (usuario?.perfil === 'ADMIN') {
      apiService.getEmpresa().then((empresa) => {
        if (!empresa.onboarding_concluido) {
          setShowOnboarding(true);
        }
      }).catch(() => {});
    }
  }, [usuario]);

  // Garante que o usuário não fique preso em uma aba de módulo que foi desativado
  useEffect(() => {
    const abasBasicas = ['dashboard', 'ponto', 'notificacoes', 'usuarios', 'empresa'];
    if (!abasBasicas.includes(activeTab) && !modulosAtivos.includes(activeTab)) {
      setActiveTab(isAdmin ? 'dashboard' : 'pdv');
    }
  }, [modulosAtivos, activeTab, isAdmin]);

  // Checa status do ponto e do caixa periodicamente
  useEffect(() => {
    if (!usuario) return;

    const verificarStatus = async () => {
      try {
        const [c, s] = await Promise.all([
          apiService.getCaixaAtual().catch(() => null),
          apiService.getStatusPontoHoje().catch(() => null)
        ]);
        setCaixaAberto(!!c);
        setCaixaAtual(c || null);
        setStatusPonto(s || null);
      } catch (err) {
        // Silencioso se der erro de rede
      }
    };

    verificarStatus();
    const interval = setInterval(verificarStatus, 15000);
    return () => clearInterval(interval);
  }, [usuario, activeTab]);

  const handleLoginSuccess = async (u: Usuario) => {
    setUsuario(u);
    await carregarDadosEmpresa();

    if (u.perfil === 'ADMIN') {
      setActiveTab('dashboard');
    } else if (u.perfil === 'FINANCEIRO') {
      setActiveTab('financeiro');
    } else if (u.perfil === 'ESTOQUISTA') {
      setActiveTab('produtos');
    } else {
      setActiveTab('pdv');
    }

    // Verifica se deve exibir onboarding: apenas para administradores com empresa não configurada
    if (u.perfil === 'ADMIN') {
      try {
        const empresa = await apiService.getEmpresa();
        if (!empresa.onboarding_concluido) {
          setShowOnboarding(true);
        }
      } catch (err) {
        // Se não conseguir buscar a empresa, não exibe onboarding
      }
    }
  };

  const handleLogout = () => {
    apiService.logout();
    try {
      localStorage.removeItem('gestao_empresa_cache');
    } catch {}
    setUsuario(null);
    setShowOnboarding(false);
  };

  if (!usuario) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Exibe wizard de onboarding antes do sistema principal
  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  const renderContent = () => {
    // Se o usuário não for admin e tentar acessar abas restritas de admin, redireciona para PDV
    if (!isAdmin && (activeTab === 'dashboard' || activeTab === 'usuarios')) {
      return <PDV />;
    }

    // Bloqueio Legal Trabalhista (CLT): operadores e controladores só operam se estiverem com ponto ativo ou bypass
    // As únicas telas liberadas sem ponto são o Ponto Eletrônico (para registrar entrada) e Dados da Empresa
    const isOperacionalTab = ['pdv', 'caixa', 'produtos', 'os', 'clientes', 'relatorios', 'notificacoes'].includes(activeTab);
    const bloqueadoPelaCLT = !isAdmin && isOperacionalTab && statusPonto && statusPonto.pode_operar === false;

    if (bloqueadoPelaCLT) {
      return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto my-6 sm:my-12 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-amber-200 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
              <Clock size={36} />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 text-amber-800">
                Bloqueio Legal Trabalhista (CLT)
              </span>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                Jornada de Trabalho Não Iniciada
              </h2>
              <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                Olá, <strong>{usuario.nome}</strong>. Conforme os Arts. 58 e 71 da CLT, é obrigatório registrar a entrada no <strong>Ponto Eletrônico</strong> antes de abrir caixas, registrar vendas ou realizar movimentações de estoque.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 max-w-md mx-auto space-y-1.5 text-left">
              <p><strong>Status atual da jornada:</strong> {statusPonto.mensagem_status || 'Aguardando batida de entrada'}</p>
              <p className="text-[11px] text-slate-400">
                Dica para testes: O Gerente/Administrador pode ativar o <em>Bypass de Ponto</em> na tela de Ponto Eletrônico para testes sem restrição.
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setActiveTab('ponto')}
                className="px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 mx-auto active:scale-95"
              >
                <Clock size={18} />
                <span>Ir para o Ponto Eletrônico e Bater Entrada</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={(tab) => setActiveTab(tab)} />;
      case 'pdv':
        return <PDV />;
      case 'caixa':
        return <Caixa isAdmin={isAdminOuFinanceiro} />;
      case 'financeiro':
        return <Financeiro />;
      case 'notificacoes':
        return <Notificacoes isAdmin={isAdminOuFinanceiro} onNavigate={(tab) => setActiveTab(tab)} />;
      case 'ponto':
        return <Ponto isAdmin={isAdmin} />;
      case 'produtos':
        return <Produtos isAdmin={isAdmin || isEstoquista} />;
      case 'clientes':
        return <Clientes isAdmin={isAdmin} />;
      case 'os':
        return <OS />;
      case 'relatorios':
        return <Relatorios isAdmin={isAdminOuFinanceiro} usuarioAtual={usuario} />;
      case 'usuarios':
        return <Usuarios />;
      case 'empresa':
        return <Empresa isAdmin={isAdmin} onOpenOnboarding={() => setShowOnboarding(true)} />;
      default:
        if (isFinanceiro) return <Financeiro />;
        if (isEstoquista) return <Produtos isAdmin={true} />;
        return isAdmin ? <Dashboard onNavigate={(tab) => setActiveTab(tab)} /> : <PDV />;
    }
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      dashboard: 'Dashboard Geral',
      pdv: 'Frente de Caixa (PDV)',
      caixa: 'Controle de Caixa',
      financeiro: 'Gestão Financeira & Cofre Central',
      notificacoes: 'Centro de Ações Rápidas e Alertas',
      ponto: 'Ponto Eletrônico CLT',
      produtos: 'Produtos & Estoque',
      clientes: 'Clientes & Crédito',
      os: 'Ordens de Serviço',
      relatorios: isAdminOuFinanceiro ? 'Relatórios de Vendas' : 'Minhas Vendas Realizadas',
      usuarios: 'Gestão da Equipe',
      empresa: 'Dados da Empresa'
    };
    return titles[activeTab] || 'Sistema de Gestão';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex w-full max-w-full overflow-x-clip">
      {/* Sidebar de Navegação */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        onLogout={handleLogout}
        userName={usuario.nome}
        userPerfil={usuario.perfil}
        userFotoUrl={usuario.foto_url}
        isAdmin={isAdmin}
        onOpenOnboarding={() => setShowOnboarding(true)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        onOpenPerfil={() => setShowPerfilModal(true)}
      />

      {/* Área Principal de Conteúdo */}
      <div className={`flex-1 flex flex-col min-w-0 w-full max-w-full overflow-x-clip ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'} transition-all duration-300`}>
        <Navbar
          onMenuToggle={() => setSidebarOpen(true)}
          activeTitle={getPageTitle()}
          onOpenPDV={() => setActiveTab('pdv')}
          onOpenPonto={() => setActiveTab('ponto')}
          onOpenNotificacoes={() => setActiveTab('notificacoes')}
          caixaAberto={caixaAberto}
          caixaAtual={caixaAtual}
          userName={usuario.nome}
          userFotoUrl={usuario.foto_url}
          isAdmin={isAdmin}
          onOpenPerfil={() => setShowPerfilModal(true)}
        />

        {/* Espaçador para o cabeçalho fixo no mobile */}
        <div className="h-16 lg:hidden shrink-0" />

        <main className="flex-1 p-3 sm:p-6 max-w-7xl w-full mx-auto min-w-0">
          <ErrorBoundary>
            {renderContent()}
          </ErrorBoundary>
        </main>
      </div>

      {/* Modal Meu Perfil */}
      <MeuPerfilModal
        isOpen={showPerfilModal}
        onClose={() => setShowPerfilModal(false)}
        usuario={usuario}
        onUsuarioAtualizado={(u) => setUsuario(u)}
      />

      {/* Chatbot IA Integrado (Desativado temporariamente) */}
      {/* <ChatbotIA
        onNavigateTab={(tab) => setActiveTab(tab)}
        onOpenTour={() => setShowTour(true)}
      /> */}

      <TourModal
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <NotificationProvider>
      <EmpresaProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </EmpresaProvider>
    </NotificationProvider>
  );
};

export default App;
