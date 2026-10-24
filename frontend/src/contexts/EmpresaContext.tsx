import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/api';
import { Empresa } from '../types';

export interface PaletaCor {
  id: string;
  label: string;
  corPrimaria: string;
  bgGradiente: string;
  sidebarGradiente: string;
  accentBadge: string;
  borderHighlight: string;
  textoHighlight: string;
  bgSuave: string;
  previewHex: string;
}

export const PALETAS_CORES: Record<string, PaletaCor> = {
  sky: {
    id: 'sky',
    label: 'Azul Safira',
    corPrimaria: 'sky-600',
    bgGradiente: 'from-sky-600 to-indigo-600',
    sidebarGradiente: 'from-slate-900 via-sky-950/40 to-slate-900',
    accentBadge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    borderHighlight: 'border-sky-500',
    textoHighlight: 'text-sky-400',
    bgSuave: 'bg-sky-50',
    previewHex: '#0284c7'
  },
  cyan: {
    id: 'cyan',
    label: 'Ciano Aqua',
    corPrimaria: 'cyan-600',
    bgGradiente: 'from-cyan-600 to-blue-600',
    sidebarGradiente: 'from-slate-900 via-cyan-950/40 to-slate-900',
    accentBadge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    borderHighlight: 'border-cyan-500',
    textoHighlight: 'text-cyan-400',
    bgSuave: 'bg-cyan-50',
    previewHex: '#06b6d4'
  },
  amber: {
    id: 'amber',
    label: 'Âmbar Ouro',
    corPrimaria: 'amber-600',
    bgGradiente: 'from-amber-600 to-orange-600',
    sidebarGradiente: 'from-slate-900 via-amber-950/40 to-slate-900',
    accentBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    borderHighlight: 'border-amber-500',
    textoHighlight: 'text-amber-400',
    bgSuave: 'bg-amber-50',
    previewHex: '#f59e0b'
  },
  emerald: {
    id: 'emerald',
    label: 'Verde Esmeralda',
    corPrimaria: 'emerald-600',
    bgGradiente: 'from-emerald-600 to-teal-600',
    sidebarGradiente: 'from-slate-900 via-emerald-950/40 to-slate-900',
    accentBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    borderHighlight: 'border-emerald-500',
    textoHighlight: 'text-emerald-400',
    bgSuave: 'bg-emerald-50',
    previewHex: '#10b981'
  },
  purple: {
    id: 'purple',
    label: 'Vinho Púrpura',
    corPrimaria: 'purple-600',
    bgGradiente: 'from-purple-700 to-pink-600',
    sidebarGradiente: 'from-slate-900 via-purple-950/40 to-slate-900',
    accentBadge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    borderHighlight: 'border-purple-500',
    textoHighlight: 'text-purple-400',
    bgSuave: 'bg-purple-50',
    previewHex: '#9333ea'
  },
  rose: {
    id: 'rose',
    label: 'Rubi Rosa',
    corPrimaria: 'rose-600',
    bgGradiente: 'from-rose-600 to-red-600',
    sidebarGradiente: 'from-slate-900 via-rose-950/40 to-slate-900',
    accentBadge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    borderHighlight: 'border-rose-500',
    textoHighlight: 'text-rose-400',
    bgSuave: 'bg-rose-50',
    previewHex: '#e11d48'
  },
  orange: {
    id: 'orange',
    label: 'Laranja Ocre',
    corPrimaria: 'orange-600',
    bgGradiente: 'from-orange-600 to-amber-600',
    sidebarGradiente: 'from-slate-900 via-orange-950/40 to-slate-900',
    accentBadge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    borderHighlight: 'border-orange-500',
    textoHighlight: 'text-orange-400',
    bgSuave: 'bg-orange-50',
    previewHex: '#ea580c'
  },
  indigo: {
    id: 'indigo',
    label: 'Índigo Noturno',
    corPrimaria: 'indigo-600',
    bgGradiente: 'from-indigo-600 to-violet-700',
    sidebarGradiente: 'from-slate-900 via-indigo-950/40 to-slate-900',
    accentBadge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    borderHighlight: 'border-indigo-500',
    textoHighlight: 'text-indigo-400',
    bgSuave: 'bg-indigo-50',
    previewHex: '#6366f1'
  }
};

export interface TemaSegmento {
  id: string;
  label: string;
  subtitulo: string;
  emoji: string;
  corPrimaria: string;
  bgGradiente: string;
  sidebarGradiente: string;
  accentBadge: string;
  borderHighlight: string;
  textoHighlight: string;
  bgSuave: string;
  terminologia: {
    pdv: string;
    itens: string;
    servicos: string;
    cliente: string;
    resumo: string;
  };
  destaqueDashboard: string;
}

export const TEMAS_SEGMENTO: Record<string, TemaSegmento> = {
  mecanica: {
    id: 'mecanica',
    label: 'Oficina Mecânica & Auto Center',
    subtitulo: 'Gestão de serviços automotivos, peças e boxes',
    emoji: '🔧',
    corPrimaria: 'amber-600',
    bgGradiente: 'from-amber-600 to-orange-600',
    sidebarGradiente: 'from-slate-900 via-amber-950/40 to-slate-900',
    accentBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    borderHighlight: 'border-amber-500',
    textoHighlight: 'text-amber-500',
    bgSuave: 'bg-amber-50',
    terminologia: {
      pdv: 'Venda de Peças',
      itens: 'Peças & Acessórios',
      servicos: 'Ordens de Serviço (Box)',
      cliente: 'Proprietário & Veículo',
      resumo: 'Oficina Automotiva em Operação',
    },
    destaqueDashboard: 'Veículos em Manutenção & Peças Trocadas',
  },
  lava_rapido: {
    id: 'lava_rapido',
    label: 'Lava Rápido & Estética Automotiva',
    subtitulo: 'Controle de fila de veículos, lavagens e estética',
    emoji: '🚗',
    corPrimaria: 'cyan-600',
    bgGradiente: 'from-cyan-600 to-blue-600',
    sidebarGradiente: 'from-slate-900 via-cyan-950/40 to-slate-900',
    accentBadge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    borderHighlight: 'border-cyan-500',
    textoHighlight: 'text-cyan-500',
    bgSuave: 'bg-cyan-50',
    terminologia: {
      pdv: 'Recebimento de Lavagens',
      itens: 'Serviços & Insumos',
      servicos: 'Fila de Lavagem & Estética',
      cliente: 'Cliente & Placa do Veículo',
      resumo: 'Lava Rápido com Fila Ativa',
    },
    destaqueDashboard: 'Veículos Lavados Hoje & Ticket Médio',
  },
  adega: {
    id: 'adega',
    label: 'Adega & Distribuidora de Bebidas',
    subtitulo: 'PDV ultra rápido, fardos, bebidas geladas e crediário',
    emoji: '🍷',
    corPrimaria: 'purple-600',
    bgGradiente: 'from-purple-700 to-pink-600',
    sidebarGradiente: 'from-slate-900 via-purple-950/40 to-slate-900',
    accentBadge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    borderHighlight: 'border-purple-500',
    textoHighlight: 'text-purple-400',
    bgSuave: 'bg-purple-50',
    terminologia: {
      pdv: 'Frente de Caixa Rápido',
      itens: 'Bebidas, Gelo & Petiscos',
      servicos: 'Entregas & Pedidos',
      cliente: 'Clientes & Contas a Receber',
      resumo: 'Adega & Conveniência em Operação',
    },
    destaqueDashboard: 'Garrafas & Fardos Vendidos / Vendas a Prazo',
  },
  material_construcao: {
    id: 'material_construcao',
    label: 'Material de Construção & Ferragens',
    subtitulo: 'Estoque pesado, metragens, orçamentos e fretes',
    emoji: '🏗️',
    corPrimaria: 'orange-600',
    bgGradiente: 'from-orange-600 to-red-600',
    sidebarGradiente: 'from-slate-900 via-orange-950/40 to-slate-900',
    accentBadge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    borderHighlight: 'border-orange-500',
    textoHighlight: 'text-orange-500',
    bgSuave: 'bg-orange-50',
    terminologia: {
      pdv: 'Balcão de Vendas',
      itens: 'Materiais & Ferramentas',
      servicos: 'Orçamentos & Cargas',
      cliente: 'Cliente & Obra',
      resumo: 'Loja de Construção Ativa',
    },
    destaqueDashboard: 'Entregas Agendadas & Materiais Críticos',
  },
  loja_roupa: {
    id: 'loja_roupa',
    label: 'Loja de Roupas & Moda',
    subtitulo: 'Catálogo de roupas, coleções, tamanhos e cores',
    emoji: '👕',
    corPrimaria: 'rose-600',
    bgGradiente: 'from-rose-600 to-pink-600',
    sidebarGradiente: 'from-slate-900 via-rose-950/40 to-slate-900',
    accentBadge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    borderHighlight: 'border-rose-500',
    textoHighlight: 'text-rose-400',
    bgSuave: 'bg-rose-50',
    terminologia: {
      pdv: 'Caixa & Embalagem',
      itens: 'Vestuário & Acessórios',
      servicos: 'Ajustes & Costuras',
      cliente: 'Cliente & Crediário',
      resumo: 'Boutique & Varejo em Operação',
    },
    destaqueDashboard: 'Peças Vendidas & Ticket Médio Fashion',
  },
  personalizado: {
    id: 'personalizado',
    label: 'Gestão Empresarial PME',
    subtitulo: 'Controle comercial, financeiro e operacional integrado',
    emoji: '⚙️',
    corPrimaria: 'sky-600',
    bgGradiente: 'from-sky-600 to-indigo-600',
    sidebarGradiente: 'from-slate-900 via-slate-800 to-slate-900',
    accentBadge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    borderHighlight: 'border-sky-500',
    textoHighlight: 'text-sky-400',
    bgSuave: 'bg-sky-50',
    terminologia: {
      pdv: 'Frente de Caixa (PDV)',
      itens: 'Produtos & Estoque',
      servicos: 'Ordens de Serviço',
      cliente: 'Clientes & Contas a Receber',
      resumo: 'Sistema de Gestão Completo',
    },
    destaqueDashboard: 'Faturamento Geral & Desempenho do Dia',
  },
};

interface EmpresaContextType {
  empresa: Partial<Empresa>;
  setEmpresa: React.Dispatch<React.SetStateAction<Partial<Empresa>>>;
  modulosAtivos: string[];
  setModulosAtivos: (modulos: string[]) => void;
  perfilNegocio: string;
  setPerfilNegocio: (perfil: string) => void;
  corSelecionada: string;
  setCorSelecionada: (cor: string) => void;
  onboardingConcluido: boolean;
  setOnboardingConcluido: (v: boolean) => void;
  temaAtual: TemaSegmento;
  carregarDadosEmpresa: () => Promise<void>;
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

export const EmpresaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [empresa, setEmpresa] = useState<Partial<Empresa>>({});
  const [modulosAtivos, setModulosAtivos] = useState<string[]>([
    'pdv', 'caixa', 'produtos', 'estoque', 'clientes', 'os', 'relatorios', 'empresa', 'usuarios'
  ]);
  const [perfilNegocio, setPerfilNegocio] = useState<string>('personalizado');
  const [corSelecionada, setCorSelecionada] = useState<string>('sky');
  const [onboardingConcluido, setOnboardingConcluido] = useState(false);

  const carregarDadosEmpresa = async () => {
    try {
      const dados = await apiService.getEmpresa();
      if (dados) {
        setEmpresa(dados);
        if (dados.perfil_negocio) {
          setPerfilNegocio(dados.perfil_negocio);
        }
        if (dados.cor_primaria && PALETAS_CORES[dados.cor_primaria]) {
          setCorSelecionada(dados.cor_primaria);
        } else if (dados.perfil_negocio) {
          // Usa a cor recomendada do ramo se nenhuma cor customizada tiver sido salva
          const corPadraoRamo: Record<string, string> = {
            mecanica: 'amber',
            lava_rapido: 'cyan',
            adega: 'purple',
            material_construcao: 'orange',
            loja_roupa: 'rose',
            personalizado: 'sky'
          };
          setCorSelecionada(corPadraoRamo[dados.perfil_negocio] || 'sky');
        }
        if (dados.modulos_ativos) {
          try {
            const parsed = typeof dados.modulos_ativos === 'string'
              ? JSON.parse(dados.modulos_ativos)
              : dados.modulos_ativos;
            if (Array.isArray(parsed) && parsed.length > 0) {
              setModulosAtivos(parsed);
            }
          } catch (e) {
            console.warn('Erro ao decodificar modulos_ativos:', e);
          }
        }
        setOnboardingConcluido(!!dados.onboarding_concluido);
      }
    } catch (err) {
      // Falha silenciosa se não autenticado ainda
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('gestao_token') || sessionStorage.getItem('gestao_token');
    if (token) {
      carregarDadosEmpresa();
    }
  }, []);

  // Combina o tema do segmento com a paleta de cor selecionada pelo usuário
  const temaAtual = useMemo(() => {
    const base = TEMAS_SEGMENTO[perfilNegocio] || TEMAS_SEGMENTO.personalizado;
    const paleta = PALETAS_CORES[corSelecionada];

    if (!paleta) return base;

    return {
      ...base,
      corPrimaria: paleta.corPrimaria,
      bgGradiente: paleta.bgGradiente,
      sidebarGradiente: paleta.sidebarGradiente,
      accentBadge: paleta.accentBadge,
      borderHighlight: paleta.borderHighlight,
      textoHighlight: paleta.textoHighlight,
      bgSuave: paleta.bgSuave,
    };
  }, [perfilNegocio, corSelecionada]);

  // Atualiza dinamicamente o Favicon e o Título do Navegador com o ícone e nome do segmento
  useEffect(() => {
    const emoji = temaAtual.emoji || '🏪';
    const svgFavicon = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${emoji}</text></svg>`;
    
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = svgFavicon;

    const nome = empresa.nome_fantasia || empresa.razao_social || 'Sistema de Gestão';
    document.title = `${emoji} ${nome}`;
  }, [temaAtual.emoji, empresa.nome_fantasia, empresa.razao_social]);

  return (
    <EmpresaContext.Provider
      value={{
        empresa,
        setEmpresa,
        modulosAtivos,
        setModulosAtivos,
        perfilNegocio,
        setPerfilNegocio,
        corSelecionada,
        setCorSelecionada,
        onboardingConcluido,
        setOnboardingConcluido,
        temaAtual,
        carregarDadosEmpresa,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
};

export const useEmpresa = () => {
  const ctx = useContext(EmpresaContext);
  if (!ctx) throw new Error('useEmpresa must be used within EmpresaProvider');
  return ctx;
};
