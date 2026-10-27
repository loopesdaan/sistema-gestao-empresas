import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Wallet, Package, Users, 
  Wrench, BarChart3, Settings, LogOut, X, Shield, Sparkles, Clock, Bell,
  ChevronLeft, ChevronRight, Landmark
} from 'lucide-react';
import { useEmpresa } from '../contexts/EmpresaContext';
import { resolveImageUrl } from '../services/api';

interface MenuItemDef {
  id: string;
  label: string;
  icon: any;
  highlight?: boolean;
  adminOnly?: boolean;
  adminOuFinanceiro?: boolean;
  modulo: string;
  sempreVisivel?: boolean;
  sempreAdmin?: boolean;
}

interface MenuGroupDef {
  id: string;
  titulo: string;
  items: MenuItemDef[];
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onLogout: () => void;
  userName?: string;
  userPerfil?: string;
  empresaNome?: string;
  isAdmin?: boolean;
  onOpenOnboarding?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  setIsOpen,
  onLogout,
  userName = 'Administrador',
  userPerfil = 'ADMIN',
  empresaNome = 'Gestão PME',
  isAdmin = false,
  onOpenOnboarding,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { modulosAtivos, temaAtual, empresa } = useEmpresa();
  const nomeExibicao = empresa.nome_fantasia || empresaNome;

  const [logoFalhou, setLogoFalhou] = useState(false);
  useEffect(() => {
    setLogoFalhou(false);
  }, [empresa.logo_url]);

  const isEstoquista = userPerfil === 'ESTOQUISTA';
  const isOperador = userPerfil === 'OPERADOR_CAIXA';
  const isFinanceiro = userPerfil === 'FINANCEIRO';
  const isAdminOuFinanceiro = isAdmin || isFinanceiro;

  // Nomenclatura contextual de serviços/OS de acordo com o segmento da empresa
  const labelServicos = temaAtual?.terminologia?.servicos 
    ? (temaAtual.terminologia.servicos.includes('OS') ? temaAtual.terminologia.servicos : `${temaAtual.terminologia.servicos} (OS)`)
    : 'Ordens de Serviço (OS)';

  // Estrutura organizada por grupos lógicos (Padrão de Mercado para ERP / SaaS)
  const menuGrupos: MenuGroupDef[] = [
    {
      id: 'operacao',
      titulo: 'Operação & Vendas',
      items: [
        { id: 'dashboard', label: 'Dashboard Geral', icon: LayoutDashboard, adminOnly: true, modulo: 'dashboard', sempreAdmin: true },
        { id: 'pdv', label: 'Frente de Caixa (PDV)', icon: ShoppingCart, highlight: true, modulo: 'pdv' },
        { id: 'os', label: labelServicos, icon: Wrench, modulo: 'os' },
        { id: 'notificacoes', label: 'Notificações & Ações', icon: Bell, sempreVisivel: true, modulo: 'notificacoes' },
      ]
    },
    {
      id: 'financeiro',
      titulo: 'Financeiro & Caixa',
      items: [
        { id: 'caixa', label: 'Controle de Caixa', icon: Wallet, modulo: 'caixa' },
        { id: 'financeiro', label: 'Financeiro & Cofre', icon: Landmark, adminOuFinanceiro: true, modulo: 'financeiro' },
        { id: 'relatorios', label: 'Relatórios de Vendas', icon: BarChart3, modulo: 'relatorios' },
      ]
    },
    {
      id: 'catalogo',
      titulo: 'Catálogo & Clientes',
      items: [
        { id: 'produtos', label: 'Produtos & Estoque', icon: Package, modulo: 'produtos' },
        { id: 'clientes', label: 'Clientes & Crediário', icon: Users, modulo: 'clientes' },
      ]
    },
    {
      id: 'gestao',
      titulo: 'Equipe & Ponto CLT',
      items: [
        { id: 'ponto', label: 'Ponto Eletrônico CLT', icon: Clock, sempreVisivel: true, modulo: 'ponto' },
        { id: 'usuarios', label: 'Equipe & Usuários', icon: Shield, adminOnly: true, modulo: 'usuarios' },
      ]
    },
    {
      id: 'sistema',
      titulo: 'Configurações',
      items: [
        { id: 'empresa', label: 'Dados da Empresa', icon: Settings, modulo: 'empresa' },
      ]
    }
  ];

  // Filtra por permissão de perfil e respeita rigorosamente os módulos ativos da empresa
  const filtrarItem = (item: MenuItemDef) => {
    // 1. Recursos essenciais de conformidade e gestão interna
    if (item.id === 'ponto' || item.id === 'notificacoes') return true;
    if (item.id === 'empresa') return true;
    if (item.id === 'usuarios') return isAdmin;
    if (item.id === 'dashboard') return isAdmin;
    if (item.id === 'financeiro') return isAdminOuFinanceiro;

    // 2. Módulos operacionais do negócio: DEVEM respeitar os módulos ativos na empresa!
    if (!modulosAtivos.includes(item.modulo)) {
      return false;
    }

    // 3. Regras específicas de colaboradores:
    // Controlador de Estoque: só opera o módulo de Produtos & Estoque
    if (isEstoquista) {
      return item.id === 'produtos';
    }

    // Financeiro: não opera frente de caixa PDV de balcão
    if (isFinanceiro) {
      return item.id !== 'pdv';
    }

    // Operador de Caixa e Administrador: visualizam todos os módulos operacionais ativos
    return true;
  };

  const gruposFiltrados = menuGrupos
    .map(grupo => ({
      ...grupo,
      items: grupo.items.filter(filtrarItem)
    }))
    .filter(grupo => grupo.items.length > 0);

  return (
    <>
      {/* Overlay Mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 ${isCollapsed ? 'lg:w-20' : 'lg:w-72'} w-72 bg-slate-900 bg-gradient-to-b ${temaAtual.sidebarGradiente} text-slate-200 flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header da Sidebar com Tema do Segmento */}
        <div className={`border-b border-slate-800/80 flex transition-all duration-200 ${
          isCollapsed 
            ? 'p-4 lg:px-2 lg:py-3 lg:flex-col lg:items-center lg:gap-2.5 items-center justify-between' 
            : 'p-4 items-center justify-between gap-2'
        }`}>
          <div className={`flex items-center ${isCollapsed ? 'lg:justify-center lg:w-full' : 'gap-3 min-w-0 flex-1 overflow-hidden'}`}>
            {empresa.logo_url && !logoFalhou ? (
              <img
                src={resolveImageUrl(empresa.logo_url)}
                alt={nomeExibicao}
                title={nomeExibicao}
                onError={() => setLogoFalhou(true)}
                className="w-10 h-10 rounded-xl object-contain border border-slate-700/80 shadow-md shrink-0 bg-white p-0.5"
              />
            ) : (
              <div 
                title={nomeExibicao}
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${temaAtual.bgGradiente} flex items-center justify-center text-white text-xl shadow-md shrink-0 border border-white/20`}
              >
                {temaAtual.emoji}
              </div>
            )}
            <div className={`overflow-hidden min-w-0 flex-1 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <h1 className="font-bold text-white text-sm leading-snug truncate" title={nomeExibicao}>{nomeExibicao}</h1>
              <span className={`text-[11px] font-semibold ${temaAtual.textoHighlight} block truncate`} title={temaAtual.label}>
                {temaAtual.label}
              </span>
            </div>
          </div>

          {/* Botão de Toggle Expandir / Recolher Menu no Desktop */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              className={`
                hidden lg:flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0
                ${isCollapsed ? 'w-8 h-8' : 'p-1.5'}
              `}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          )}

          <button 
            onClick={() => setIsOpen(false)} 
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-md shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Links de Navegação Agrupados */}
        <nav className={`flex-1 overflow-y-auto ${isCollapsed ? 'lg:px-2' : 'px-3'} py-3 space-y-1`}>
          {gruposFiltrados.map((grupo, gIdx) => (
            <div key={grupo.id} className="space-y-1">
              {/* Título da Seção do Menu */}
              {!isCollapsed ? (
                <div className={`px-3.5 pb-1 ${gIdx > 0 ? 'pt-3.5' : 'pt-1'}`}>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400/80 block select-none">
                    {grupo.titulo}
                  </span>
                </div>
              ) : (
                gIdx > 0 && <div className="my-2 border-t border-slate-800/80 mx-2" />
              )}

              {/* Itens do Grupo */}
              {grupo.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsOpen(false);
                    }}
                    title={item.label}
                    className={`
                      w-full flex items-center ${isCollapsed ? 'lg:justify-center lg:px-0' : 'px-3.5'} py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 text-left gap-3
                      ${isActive 
                        ? `bg-gradient-to-r ${temaAtual.bgGradiente} text-white shadow-md shadow-black/20 font-bold` 
                        : item.highlight
                          ? `${temaAtual.textoHighlight} hover:bg-slate-800/80 bg-slate-800/40 border ${temaAtual.borderHighlight}/30`
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      }
                    `}
                  >
                    <Icon size={18} className={`shrink-0 ${isActive ? 'text-white' : item.highlight ? 'opacity-90' : 'text-slate-400'}`} />
                    <span className={`truncate whitespace-nowrap ${isCollapsed ? 'lg:hidden' : ''}`}>
                      {isOperador && item.id === 'relatorios' ? 'Minhas Vendas' : item.label}
                    </span>
                    {item.highlight && !isActive && (
                      <span className={`ml-auto text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${temaAtual.accentBadge} ${isCollapsed ? 'lg:hidden' : ''}`}>
                        Rápido
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Botão Assistente de Configuração para Administradores */}
        {isAdmin && onOpenOnboarding && (
          <div className="px-3 pb-2">
            <button
              onClick={() => {
                onOpenOnboarding();
                setIsOpen(false);
              }}
              title="Personalizar Módulos"
              className={`w-full flex items-center justify-center gap-2 ${isCollapsed ? 'lg:px-0' : 'px-3'} py-2 rounded-xl text-xs font-semibold bg-gradient-to-r ${temaAtual.bgGradiente} hover:opacity-95 text-white shadow-md shadow-black/20 transition-all border border-white/20`}
            >
              <Sparkles size={14} className="shrink-0" />
              <span className={isCollapsed ? 'lg:hidden' : ''}>Personalizar Módulos</span>
            </button>
          </div>
        )}

        {/* Footer do Usuário */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className={`flex items-center ${isCollapsed ? 'lg:flex-col lg:gap-2' : 'justify-between'} p-2 rounded-lg bg-slate-900/80`}>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>
                <p className="text-xs font-medium text-white truncate">{userName}</p>
                <p className="text-[11px] text-sky-400 font-medium truncate">
                  {userPerfil === 'ADMIN' || isAdmin
                    ? 'Gerente Geral'
                    : userPerfil === 'FINANCEIRO'
                      ? 'Financeiro & Tesouraria'
                      : userPerfil === 'ESTOQUISTA'
                        ? 'Controlador de Estoque'
                        : 'Operador de Caixa'}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Sair do sistema"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
