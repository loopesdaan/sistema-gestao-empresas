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
import { Onboarding } from './pages/Onboarding';
import { ChatbotIA } from './components/ChatbotIA';
import { TourModal } from './components/TourModal';
import { apiService } from './services/api';
import { Usuario, Caixa as CaixaType } from './types';
import { NotificationProvider } from './contexts/NotificationContext';
import { EmpresaProvider } from './contexts/EmpresaContext';

// Componente interno que usa os contextos
const AppContent: React.FC = () => {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const salvo = localStorage.getItem('gestao_user') || sessionStorage.getItem('gestao_user');
    return salvo ? JSON.parse(salvo) : null;
  });

  const isAdmin = usuario?.perfil === 'ADMIN';

  const [activeTab, setActiveTab] = useState(() => {
    const salvo = localStorage.getItem('gestao_user') || sessionStorage.getItem('gestao_user');
    const u = salvo ? JSON.parse(salvo) : null;
    if (u?.perfil === 'ADMIN') return 'dashboard';
    if (u?.perfil === 'ESTOQUISTA') return 'produtos';
    return 'pdv';
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [caixaAberto, setCaixaAberto] = useState(false);
  const [caixaAtual, setCaixaAtual] = useState<CaixaType | null>(null);
  // Controla exibição do wizard de onboarding inicial
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Verifica onboarding assim que o usuário loga ou entra na página
  useEffect(() => {
    if (usuario?.perfil === 'ADMIN') {
      apiService.getEmpresa().then((empresa) => {
        if (!empresa.onboarding_concluido) {
          setShowOnboarding(true);
        }
      }).catch(() => {});
    }
  }, [usuario]);

  // Checa status do caixa periodicamente
  useEffect(() => {
    if (!usuario) return;

    const verificarCaixa = async () => {
      try {
        const c = await apiService.getCaixaAtual();
        setCaixaAberto(!!c);
        setCaixaAtual(c || null);
      } catch (err) {
        // Silencioso se der erro de rede
      }
    };

    verificarCaixa();
    const interval = setInterval(verificarCaixa, 30000);
    return () => clearInterval(interval);
  }, [usuario, activeTab]);

  const handleLoginSuccess = async (u: Usuario) => {
    setUsuario(u);
    if (u.perfil === 'ADMIN') {
      setActiveTab('dashboard');
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
    // Se o usuário não for admin e tentar acessar abas de admin, redireciona para PDV
    if (!isAdmin && (activeTab === 'dashboard' || activeTab === 'relatorios' || activeTab === 'usuarios')) {
      return <PDV />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={(tab) => setActiveTab(tab)} />;
      case 'pdv':
        return <PDV />;
      case 'caixa':
        return <Caixa isAdmin={isAdmin} />;
      case 'ponto':
        return <Ponto isAdmin={isAdmin} />;
      case 'produtos':
        return <Produtos isAdmin={isAdmin} />;
      case 'clientes':
        return <Clientes />;
      case 'os':
        return <OS />;
      case 'relatorios':
        return <Relatorios />;
      case 'usuarios':
        return <Usuarios />;
      case 'empresa':
        return <Empresa isAdmin={isAdmin} onOpenOnboarding={() => setShowOnboarding(true)} />;
      default:
        return isAdmin ? <Dashboard onNavigate={(tab) => setActiveTab(tab)} /> : <PDV />;
    }
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      dashboard: 'Dashboard Geral',
      pdv: 'Frente de Caixa (PDV)',
      caixa: 'Controle de Caixa',
      ponto: 'Ponto Eletrônico CLT',
      produtos: 'Produtos & Estoque',
      clientes: 'Clientes & Crédito',
      os: 'Ordens de Serviço',
      relatorios: 'Relatórios de Vendas',
      usuarios: 'Gestão da Equipe',
      empresa: 'Dados da Empresa'
    };
    return titles[activeTab] || 'Sistema de Gestão';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar de Navegação */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        onLogout={handleLogout}
        userName={usuario.nome}
        isAdmin={isAdmin}
        onOpenOnboarding={() => setShowOnboarding(true)}
      />

      {/* Área Principal de Conteúdo */}
      <div className="flex-1 flex flex-col lg:pl-64 transition-all duration-300">
        <Navbar
          onMenuToggle={() => setSidebarOpen(true)}
          activeTitle={getPageTitle()}
          onOpenPDV={() => setActiveTab('pdv')}
          caixaAberto={caixaAberto}
          caixaAtual={caixaAtual}
          userName={usuario.nome}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {renderContent()}
        </main>
      </div>

      {/* Chatbot IA Integrado & Tour Interativo */}
      <ChatbotIA
        onNavigateTab={(tab) => setActiveTab(tab)}
        onOpenTour={() => setShowTour(true)}
      />

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
        <AppContent />
      </EmpresaProvider>
    </NotificationProvider>
  );
};

export default App;
