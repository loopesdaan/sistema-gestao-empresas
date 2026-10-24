import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, X, Send, Sparkles, MessageSquare, ChevronDown, 
  HelpCircle, ExternalLink, ArrowRight, CheckCircle2, ShoppingCart, 
  Wallet, Clock, BarChart3, Wrench, Package, Users
} from 'lucide-react';
import { useEmpresa } from '../contexts/EmpresaContext';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  texto: string;
  acao?: {
    label: string;
    tab: string;
  };
  timestamp: string;
}

interface ChatbotIAProps {
  onNavigateTab?: (tab: string) => void;
  onOpenTour?: () => void;
}

const FAQ_KNOWLEDGE_BASE: Array<{
  keywords: string[];
  resposta: string;
  acao?: { label: string; tab: string };
}> = [
  {
    keywords: ['pix', 'mercado pago', 'qr code', 'pagamento pix', 'copia e cola'],
    resposta: 'O módulo de PIX do sistema é integrado diretamente ao Mercado Pago. No momento da venda no PDV ou cobrança de OS, o sistema gera o QR Code dinâmico com valor exato. É possível também simular o pagamento em modo de desenvolvimento ou ler o QR Code diretamente com o aplicativo bancário.',
    acao: { label: 'Ir para Frente de Caixa (PDV)', tab: 'pdv' }
  },
  {
    keywords: ['caixa', 'abrir caixa', 'fechar caixa', 'sangria', 'suprimento', 'gaveta', 'quebra'],
    resposta: 'No Controle de Caixa você pode registrar a Abertura com Fundo de Troco, solicitar Suprimentos ou Sangrias (inclusive Sangria Cega para o administrador recolher valores sem revelar o total em tela). O sistema audita automaticamente quebras de caixa (diferença entre o apurado pelas vendas e o dinheiro físico contado).',
    acao: { label: 'Abrir Controle de Caixa', tab: 'caixa' }
  },
  {
    keywords: ['ponto', 'clt', 'hora extra', 'horario', 'interjornada', 'artigo 66', 'artigo 59', '11 horas', '2 horas', 'trava'],
    resposta: 'O módulo de Ponto Eletrônico opera em rigorosa conformidade com a CLT: exige 4 batidas (Entrada, Saída Almoço, Retorno Almoço, Saída Final), respeita o intervalo mínimo de 11 horas consecutivas de descanso (Art. 66 CLT) e limita horas extras a no máximo 2 horas diárias (Art. 59 CLT). Se o tempo expirar sem aprovação do ADM, o PDV trava de forma inteligente após a venda atual.',
    acao: { label: 'Acessar Ponto Eletrônico', tab: 'ponto' }
  },
  {
    keywords: ['relatorio', 'relatorios', 'excel', 'pdf', 'csv', 'exportar', 'extracao'],
    resposta: 'Você pode exportar relatórios completos de vendas em Excel (.csv separado por ponto e vírgula com UTF-8 BOM para abrir sem erros de acentuação), arquivo HTML estilizado e impressão direta em PDF. O Dashboard também pode ser exportado em formato HTML com todos os gráficos.',
    acao: { label: 'Ver Relatórios de Vendas', tab: 'relatorios' }
  },
  {
    keywords: ['ordem de servico', 'os', 'servico', 'veiculo', 'mecanica', 'peças', 'laudo'],
    resposta: 'As Ordens de Serviço permitem registrar laudos técnicos, equipamentos ou veículos (placa, modelo, cor) e separar o valor de mão de obra de peças. É possível faturar uma OS diretamente na tela de OS ou importá-la direto para o carrinho do PDV para vender peças e serviços na mesma comanda.',
    acao: { label: 'Ir para Ordens de Serviço', tab: 'os' }
  },
  {
    keywords: ['estoque', 'produto', 'produtos', 'decimal', 'inteiro', 'quantidade'],
    resposta: 'O cadastro de produtos permite definir preços de custo, venda, código de barras e estoque mínimo com alerta visual. Para itens unitários, a quantidade foi travada para valores inteiros e consistentes, impedindo fracionamentos incorretos.',
    acao: { label: 'Gestão de Estoque', tab: 'produtos' }
  },
  {
    keywords: ['cliente', 'clientes', 'credito', 'crediario', 'a prazo', 'limite'],
    resposta: 'No cadastro de clientes você acompanha histórico de compras, limite de crédito e saldo devedor. Pagamentos a prazo geram cobranças automáticas e notificações persistentes que só desaparecem quando o débito for regularizado.',
    acao: { label: 'Clientes & Crédito', tab: 'clientes' }
  },
  {
    keywords: ['segmento', 'personalizar', 'cor', 'onboarding', 'mudar cor', 'adega', 'lava rapido'],
    resposta: 'O sistema se adapta a 6 ramos comerciais: Mecânica, Lava Rápido, Adegas, Material de Construção, Lojas de Roupas e Personalizado. Cada um possui terminologia sob medida, catálogo modelo e paletas de cores (Safira, Ciano, Esmeralda, Âmbar, Púrpura, Rubi, etc.) que personalizam botões, menus e indicadores.',
    acao: { label: 'Configurar Empresa & Visual', tab: 'empresa' }
  }
];

export const ChatbotIA: React.FC<ChatbotIAProps> = ({ onNavigateTab, onOpenTour }) => {
  const { temaAtual } = useEmpresa();
  const [aberto, setAberto] = useState(false);
  const [inputTexto, setInputTexto] = useState('');
  const [digitando, setDigitando] = useState(false);
  const [mensagens, setMensagens] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      texto: `Olá! Sou o Assistente Inteligente do seu sistema de gestão. Como posso ajudar seu dia a dia hoje? Você pode me perguntar sobre vendas, caixa, ponto CLT, estoque ou relatórios!`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const endMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberto) {
      endMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagens, aberto]);

  const processarPergunta = (pergunta: string) => {
    const q = pergunta.toLowerCase().trim();
    
    // Procura na base de conhecimento
    for (const item of FAQ_KNOWLEDGE_BASE) {
      if (item.keywords.some(k => q.includes(k))) {
        return {
          resposta: item.resposta,
          acao: item.acao
        };
      }
    }

    // Resposta padrão inteligente
    return {
      resposta: `Entendi sua dúvida sobre "${pergunta}". Este sistema conta com módulos integrados de PDV, Ordens de Serviço, Estoque, Ponto Eletrônico CLT e Controle de Caixa com Auditoria. Caso queira, posso te guiar por qualquer uma dessas áreas!`,
      acao: { label: 'Fazer Tour do Sistema', tab: 'tour' }
    };
  };

  const handleEnviarMensagem = (textoParaEnviar?: string) => {
    const texto = (textoParaEnviar || inputTexto).trim();
    if (!texto) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      texto: texto,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMensagens(prev => [...prev, userMsg]);
    setInputTexto('');
    setDigitando(true);

    setTimeout(() => {
      const { resposta, acao } = processarPergunta(texto);
      const botMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'bot',
        texto: resposta,
        acao: acao,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMensagens(prev => [...prev, botMsg]);
      setDigitando(false);
    }, 450);
  };

  const handleAcaoBotao = (tab: string) => {
    if (tab === 'tour' && onOpenTour) {
      onOpenTour();
    } else if (onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {/* Botão Flutuante quando fechado */}
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className={`flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r ${temaAtual.bgGradiente} text-white font-bold text-xs rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all border-2 border-white/40`}
          title="Assistente IA do Sistema"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Bot size={16} />
          </div>
          <span>Assistente IA</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </button>
      )}

      {/* Janela de Chat Aberta */}
      {aberto && (
        <div className="w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col h-[520px] max-h-[85vh] overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* Header do Chat */}
          <div className={`p-4 bg-gradient-to-r ${temaAtual.bgGradiente} text-white flex items-center justify-between shadow-xs`}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-xs">
                <Bot size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  <span>IA Operacional</span>
                  <Sparkles size={13} className="text-amber-300" />
                </h4>
                <p className="text-[10px] text-white/80">Especialista no Sistema & Normas CLT</p>
              </div>
            </div>

            <button
              onClick={() => setAberto(false)}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Sugestões Rápidas */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[10px]">
            {[
              'Como abrir caixa?',
              'Regras Ponto CLT',
              'Exportar em Excel',
              'PIX Mercado Pago'
            ].map((sugestao, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleEnviarMensagem(sugestao)}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 whitespace-nowrap shadow-2xs transition-colors shrink-0"
              >
                {sugestao}
              </button>
            ))}
          </div>

          {/* Histórico de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 text-xs">
            {mensagens.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl leading-relaxed shadow-2xs ${
                    msg.sender === 'user'
                      ? `bg-gradient-to-r ${temaAtual.bgGradiente} text-white rounded-br-xs`
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                  }`}
                >
                  <p>{msg.texto}</p>

                  {/* Ação Interativa no Chat */}
                  {msg.acao && (
                    <button
                      type="button"
                      onClick={() => handleAcaoBotao(msg.acao!.tab)}
                      className="mt-2.5 w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <span>{msg.acao.label}</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
                <span className="text-[9px] text-slate-400 mt-0.5 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {digitando && (
              <div className="flex items-center gap-1 text-slate-400 text-[11px] p-2 bg-white rounded-2xl w-fit border border-slate-100">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                <span className="ml-1 text-[10px]">Pensando...</span>
              </div>
            )}
            <div ref={endMessagesRef} />
          </div>

          {/* Input de Envio */}
          <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
            <input
              type="text"
              value={inputTexto}
              onChange={(e) => setInputTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleEnviarMensagem();
                }
              }}
              placeholder="Pergunte sobre vendas, CLT, caixa..."
              className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => handleEnviarMensagem()}
              disabled={!inputTexto.trim()}
              className={`p-2.5 rounded-xl text-white transition-all disabled:opacity-40 bg-gradient-to-r ${temaAtual.bgGradiente}`}
            >
              <Send size={15} />
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

