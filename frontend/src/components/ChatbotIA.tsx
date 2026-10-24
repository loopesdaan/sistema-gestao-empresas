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
    keywords: ['cancelar venda', 'cancelar', 'estornar', 'estorno', 'cancelamento', 'devolver item'],
    resposta: 'Para cancelar uma venda e estornar os produtos de volta ao estoque:\n1. Acesse o menu "Relatórios de Vendas";\n2. Localize a venda na tabela (você pode buscar pelo ID da venda ou nome do cliente);\n3. Na coluna de ações à direita, clique no botão vermelho "Cancelar";\n4. Confirme a operação.\n\nO sistema atualizará o status para "Cancelada" e devolverá automaticamente as quantidades vendidas de cada produto para o estoque físico.',
    acao: { label: 'Ir para Relatórios de Vendas', tab: 'relatorios' }
  },
  {
    keywords: ['bater ponto', 'ponto', 'onde bater', 'jornada', 'bater o ponto', 'ponto clt', 'almoco', 'entrada', 'saida'],
    resposta: 'Para registrar seu ponto de trabalho:\n1. Clique no botão "Bater Ponto" localizado na barra superior (ao lado do status do Caixa) ou no menu lateral "Ponto Eletrônico CLT";\n2. Você encontrará os 4 registros da jornada:\n   • 1ª Batida: Entrada Inicial (Ex: 09:00)\n   • 2ª Batida: Saída para Almoço (Ex: 12:00)\n   • 3ª Batida: Retorno do Almoço (Ex: 13:00)\n   • 4ª Batida: Saída do Turno (Ex: 18:00)\n\nO sistema monitora a jornada em conformidade com a CLT: intervalo interjornada de 11h (Art. 66) e limite de 2 horas extras diárias (Art. 59), avisando o Gerente para liberação formal.',
    acao: { label: 'Acessar Ponto Eletrônico', tab: 'ponto' }
  },
  {
    keywords: ['comprovante', 'recibo', 'nota digital', 'pagina em branco', 'imprimir', 'cupom', 'termica'],
    resposta: 'Todos os comprovantes do sistema (PDV, Ordens de Serviço, Relatórios de Vendas e Caixa) utilizam o Comprovante Digital Térmico:\n• O comprovante abre instantaneamente como um modal sobre a tela atual, sem abrir abas em branco;\n• Exibe itens, vendedor, cliente, formas de pagamento e troco;\n• O botão "Imprimir" dispara a impressão térmica de 80mm ou PDF em segundo plano;\n• Você pode fechar o comprovante clicando no "X" ou fora do modal.',
    acao: { label: 'Ver Relatório de Vendas', tab: 'relatorios' }
  },
  {
    keywords: ['estoquista', 'controlador de estoque', 'dashboard de estoque', 'patrimonio', 'estoque critico', 'ajustar estoque'],
    resposta: 'O perfil "Controlador de Estoque" trabalha exclusivamente com a gestão física do estoque (não realiza vendas no PDV nem gera OS):\n• Dashboard de Estoque: calcula o patrimônio a custo, projeção de venda bruta, lucro esperado e margem média;\n• Sugestão de Reposição: alerta produtos esgotados (zerados) ou abaixo do estoque mínimo com botão de entrada rápida;\n• Histórico de Movimentações: audita todas as entradas, saídas e balanços com operador e justificativa, notificando o Gerente em tempo real.',
    acao: { label: 'Abrir Gestão de Estoque', tab: 'produtos' }
  },
  {
    keywords: ['pix', 'mercado pago', 'qr code', 'pagamento pix', 'copia e cola', 'chave pix'],
    resposta: 'A cobrança via PIX é integrada diretamente ao Mercado Pago:\n• No checkout do PDV ou cobrança de OS, selecione "PIX Mercado Pago" e clique em "Gerar QR Code";\n• O QR Code é gerado vetorialmente em SVG na tela para leitura direta pelo aplicativo do banco;\n• É possível clicar em "Copiar Pix Copia e Cola" ou em "Simular Pagamento Pago (Dev)" para testes rápidos em ambiente de demonstração.',
    acao: { label: 'Ir para Frente de Caixa (PDV)', tab: 'pdv' }
  },
  {
    keywords: ['caixa', 'abrir caixa', 'fechar caixa', 'sangria', 'suprimento', 'sangria cega', 'quebra'],
    resposta: 'No módulo de Controle de Caixa:\n• Abertura: informe o fundo de troco inicial;\n• Suprimento e Sangria: solicite entradas ou retiradas com justificativa;\n• Sangria Cega: o Gerente pode exigir a retirada sem que o operador veja o saldo total em tela;\n• Fechamento: o operador conta o dinheiro da gaveta e digita o valor. O sistema audita quebras ou sobras de caixa;\n• Comprovantes: permite navegar pelo histórico de cada venda realizada no turno.',
    acao: { label: 'Abrir Controle de Caixa', tab: 'caixa' }
  },
  {
    keywords: ['ordem de servico', 'os', 'servico', 'mecanica', 'placa', 'pecas', 'veiculo', 'laudo'],
    resposta: 'Nas Ordens de Serviço (OS):\n• O Operador de Caixa e o Gerente podem cadastrar ordens informando cliente, veículo/equipamento, defeito relatado e laudo técnico;\n• O sistema separa o total de mão de obra de peças aplicadas;\n• Cobrança flexível: você pode faturar a OS diretamente na tela de OS ou importá-la para o PDV para cobrar produtos e serviços no mesmo comprovante.',
    acao: { label: 'Ir para Ordens de Serviço', tab: 'os' }
  },
  {
    keywords: ['cliente', 'clientes', 'credito', 'crediario', 'fiado', 'saldo devedor', 'placa veiculo'],
    resposta: 'No módulo de Clientes & Crédito:\n• Dashboard no topo exibe o total de clientes, valor de fiado em aberto e clientes em atraso;\n• Para Adega e varejo, campos de veículos ficam ocultos para agilizar o cadastro;\n• Para Lava Rápido e Mecânica, a seção de placa e modelo do veículo fica ativa em destaque;\n• Vendas a prazo lançam o débito diretamente na ficha do cliente.',
    acao: { label: 'Clientes & Crédito', tab: 'clientes' }
  },
  {
    keywords: ['relatorio', 'relatorios', 'excel', 'pdf', 'csv', 'exportar', 'html', 'extracao'],
    resposta: 'Os relatórios de vendas contam com múltiplas formas de extração:\n• Planilha Excel (.csv com formatação brasileira e separador por ponto e vírgula);\n• Relatório Web (.html estilizado);\n• Documento PDF para salvar ou imprimir sem abrir abas em branco;\n• O Operador de Caixa consulta o relatório das vendas dele, enquanto o Gerente tem acesso a todas as vendas da empresa.',
    acao: { label: 'Ver Relatórios de Vendas', tab: 'relatorios' }
  },
  {
    keywords: ['segmento', 'adega', 'lava rapido', 'mecanica', 'personalizar', 'cor', 'mudar cor', 'onboarding'],
    resposta: 'O sistema suporta 6 segmentos comerciais:\n1. Adega & Bebidas\n2. Lava Rápido & Estética\n3. Mecânica & Auto Peças\n4. Material de Construção\n5. Loja de Roupas & Varejo\n6. Comércio Geral / Personalizado\n\nCada segmento carrega seu catálogo modelo coerente, termos apropriados, ícone no navegador e paletas temáticas (Safira, Âmbar, Ciano, Esmeralda, Vinho Púrpura, Rubi). Você pode trocar em "Dados da Empresa".',
    acao: { label: 'Configurar Empresa & Visual', tab: 'empresa' }
  },
  {
    keywords: ['perfis', 'usuarios', 'gerente', 'operador', 'cargos', 'permissoes'],
    resposta: 'Os cargos no sistema são:\n• Gerente Geral (antigo ADM): controle total de vendas, estoque, relatórios, auditoria de caixa e equipe;\n• Operador de Caixa: opera o PDV, caixa, abertura de Ordens de Serviço e consulta suas próprias vendas;\n• Controlador de Estoque: dedicado ao inventário, balanço, dashboard de estoque e histórico de movimentações (sem acesso a vendas).',
    acao: { label: 'Gestão da Equipe', tab: 'usuarios' }
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

  const normalizar = (txt: string) => {
    return txt
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  const processarPergunta = (pergunta: string) => {
    const q = normalizar(pergunta);
    
    // Procura na base de conhecimento normalizada
    for (const item of FAQ_KNOWLEDGE_BASE) {
      if (item.keywords.some(k => q.includes(normalizar(k)))) {
        return {
          resposta: item.resposta,
          acao: item.acao
        };
      }
    }

    // Resposta padrão inteligente
    return {
      resposta: `Entendi sua dúvida sobre "${pergunta}". Este sistema conta com módulos integrados de PDV, Ordens de Serviço, Estoque com Dashboard, Ponto Eletrônico CLT e Controle de Caixa com Auditoria. Caso queira, posso te guiar por qualquer uma dessas áreas!`,
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
              'Como cancelar uma venda?',
              'Onde bater o ponto?',
              'Dashboard de Estoque',
              'Como abrir caixa?',
              'PIX Mercado Pago',
              'Exportar em Excel'
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

