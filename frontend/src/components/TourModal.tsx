import React, { useState } from 'react';
import { 
  X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2, 
  ShoppingCart, Wallet, Clock, BarChart3, Wrench, Shield, Play
} from 'lucide-react';
import { useEmpresa } from '../contexts/EmpresaContext';

interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

interface StepTour {
  titulo: string;
  subtitulo: string;
  modulo: string;
  icone: any;
  descricao: string;
  destaques: string[];
  mockupGradiente: string;
  mockupConteudo: {
    topo: string;
    itens: string[];
    badge: string;
  };
}

const ETAPAS_TOUR: StepTour[] = [
  {
    titulo: '1. Personalização do Negócio & Segmentos',
    subtitulo: 'Ajuste visual e módulos adaptados para seu ramo de atuação',
    modulo: 'empresa',
    icone: Sparkles,
    descricao: 'Ao escolher seu segmento (Mecânica, Lava Rápido, Adegas, Construção, Moda ou Personalizado), o sistema altera automaticamente a nomenclatura dos menus, o catálogo de demonstração e as paletas de cores predominantes em todos os botões e indicadores.',
    destaques: [
      '6 ramos comerciais pré-configurados com dados coerentes',
      'Seleção de paletas: Azul Safira, Ciano, Âmbar, Esmeralda, Púrpura, etc.',
      'Upload do logotipo da empresa e fotos dos colaboradores'
    ],
    mockupGradiente: 'from-sky-600 to-indigo-600',
    mockupConteudo: {
      topo: 'Configuração de Segmento & Estilo',
      itens: ['Ramo: Mecânica / Auto Center', 'Paleta: Âmbar Ouro Ativa', 'Módulos: PDV, OS, Estoque e Ponto'],
      badge: 'Onboarding Ativo'
    }
  },
  {
    titulo: '2. Frente de Caixa (PDV) Híbrido & Mercado Pago',
    subtitulo: 'Venda de produtos e ordens de serviço no mesmo carrinho',
    modulo: 'pdv',
    icone: ShoppingCart,
    descricao: 'Realize vendas ágeis com leitor de código de barras, busca rápida e botão especial para importar Ordens de Serviço abertas para o mesmo cupom fiscal. O checkout é totalmente integrado ao Mercado Pago com QR Code PIX dinâmico e integração com maquininhas de cartão.',
    destaques: [
      'Venda unificada de itens físicos e serviços prestados',
      'QR Code PIX oficial Mercado Pago com verificação em tempo real',
      'Calculadora de troco automática e bloqueio de vendas sem estoque'
    ],
    mockupGradiente: 'from-emerald-600 to-teal-600',
    mockupConteudo: {
      topo: 'Terminal PDV • Caixa Aberto',
      itens: ['1x Óleo Sintético 5W30 - R$ 45,00', '1x Troca de Óleo (OS #12) - R$ 80,00', 'Total a Receber: R$ 125,00'],
      badge: 'Cobrança PIX Pronta'
    }
  },
  {
    titulo: '3. Controle de Caixa, Sangria Cega & Auditoria',
    subtitulo: 'Governança financeira e rastreamento rigoroso de quebras',
    modulo: 'caixa',
    icone: Wallet,
    descricao: 'Abertura com saldo inicial (fundo de troco), sangrias, suprimentos e tickets de solicitação que o operador envia para o administrador aprovar. A auditoria calcula a diferença exata entre o sistema e o dinheiro físico entregue pelo operador.',
    destaques: [
      'Tickets de Suprimento e Sangria Cega (ADM define valor a retirar)',
      'Painel em tempo real com barra de alerta de limite da gaveta',
      'Navegação digital de comprovantes de cada venda com anterior/próximo'
    ],
    mockupGradiente: 'from-purple-600 to-indigo-600',
    mockupConteudo: {
      topo: 'Auditoria de Sessão de Caixa',
      itens: ['Saldo Calculado pelo Sistema: R$ 1.450,00', 'Saldo Físico Declarado: R$ 1.450,00', 'Auditoria: 100% Conferido Sem Quebra'],
      badge: 'Homologado'
    }
  },
  {
    titulo: '4. Ponto Eletrônico CLT & Trava Inteligente',
    subtitulo: 'Conformidade com Art. 66 (11h descanso) e Art. 59 (2h extras)',
    modulo: 'ponto',
    icone: Clock,
    descricao: 'Registro das 4 batidas diárias (Entrada, Almoço, Retorno, Saída). O sistema impede novos turnos antes de 11h de descanso consecutivo e trava automaticamente o PDV após o encerramento da jornada caso não haja autorização prévia de hora extra do Administrador.',
    destaques: [
      'Trava Inteligente: permite concluir o cliente atual antes de bloquear',
      'Aprovação administrativa de prorrogação de jornada (até 2 horas)',
      'Auditoria de equipe em tempo real com histórico de 30 dias'
    ],
    mockupGradiente: 'from-amber-600 to-orange-600',
    mockupConteudo: {
      topo: 'Registro Diário CLT (Art. 66 & 59)',
      itens: ['Entrada: 09:00 • Saída Almoço: 12:00', 'Retorno Almoço: 13:00 • Saída Final: 18:00', 'Interjornada: 11 horas respeitadas'],
      badge: 'CLT Conforme'
    }
  },
  {
    titulo: '5. Relatórios & Exportações Completas',
    subtitulo: 'Extração instantânea em Excel (.csv), HTML e PDF',
    modulo: 'relatorios',
    icone: BarChart3,
    descricao: 'Analise faturamento diário e mensal, ticket médio, produtos mais vendidos e histórico por vendedor. Exporte relatórios em um clique para Excel (compatível com acentuação), arquivo HTML para compartilhamento ou PDF formatado para impressão.',
    destaques: [
      'Exportação em Excel (.csv com UTF-8 BOM e ponto e vírgula)',
      'Exportação da página de Dashboard completa em HTML',
      'Identificação do vendedor e operador de caixa em cada transação'
    ],
    mockupGradiente: 'from-blue-600 to-indigo-700',
    mockupConteudo: {
      topo: 'Exportação Multiformato',
      itens: ['Excel (.CSV) • UTF-8 Formatado', 'Arquivo HTML Completo', 'Relatório em PDF para Impressão'],
      badge: 'Exportar Tudo'
    }
  }
];

export const TourModal: React.FC<TourModalProps> = ({ isOpen, onClose, onNavigateTab }) => {
  const { temaAtual } = useEmpresa();
  const [etapaAtual, setEtapaAtual] = useState(0);

  if (!isOpen) return null;

  const step = ETAPAS_TOUR[etapaAtual];
  const Icone = step.icone;
  const isUltima = etapaAtual === ETAPAS_TOUR.length - 1;

  const handleIrParaModulo = () => {
    if (onNavigateTab) {
      onNavigateTab(step.modulo);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Top Header do Tour */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl bg-gradient-to-r ${temaAtual.bgGradiente} text-white shadow-xs`}>
              <Play size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Tour Guiado pelo Sistema de Gestão
              </h3>
              <p className="text-[11px] text-slate-500">
                Aprenda a operar os fluxos mais importantes da plataforma
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Indicador de Passos */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex gap-1.5">
            {ETAPAS_TOUR.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setEtapaAtual(i)}
                className={`h-2 rounded-full transition-all ${
                  i === etapaAtual
                    ? `w-8 bg-gradient-to-r ${temaAtual.bgGradiente}`
                    : i < etapaAtual
                      ? 'w-3 bg-slate-400'
                      : 'w-3 bg-slate-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-bold text-slate-500">
            Passo {etapaAtual + 1} de {ETAPAS_TOUR.length}
          </span>
        </div>

        {/* Conteúdo da Etapa */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${step.mockupGradiente} text-white flex items-center justify-center shrink-0 shadow-md`}>
              <Icone size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 leading-tight">
                {step.titulo}
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {step.subtitulo}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
            {step.descricao}
          </p>

          {/* Maquete Visual do Fluxo */}
          <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 text-white space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {step.mockupConteudo.topo}
              </span>
              <span className="text-[10px] font-bold bg-white/10 text-white px-2 py-0.5 rounded-full border border-white/20">
                {step.mockupConteudo.badge}
              </span>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              {step.mockupConteudo.itens.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-slate-300">
                  <ChevronRight size={14} className="text-emerald-400 shrink-0" />
                  <span className="truncate">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lista de Destaques / Benefícios */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Recursos Principais
            </span>
            <div className="space-y-1.5">
              {step.destaques.map((d, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setEtapaAtual(prev => Math.max(0, prev - 1))}
            disabled={etapaAtual === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            <span>Anterior</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleIrParaModulo}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors border border-slate-300"
            >
              Ir para este Módulo
            </button>

            {isUltima ? (
              <button
                type="button"
                onClick={onClose}
                className={`flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-xl bg-gradient-to-r ${temaAtual.bgGradiente} shadow-md transition-all`}
              >
                <span>Concluir Tour</span>
                <CheckCircle2 size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEtapaAtual(prev => Math.min(ETAPAS_TOUR.length - 1, prev + 1))}
                className={`flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-xl bg-gradient-to-r ${temaAtual.bgGradiente} shadow-md transition-all`}
              >
                <span>Próximo Passo</span>
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
