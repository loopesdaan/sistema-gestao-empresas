import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, X, Send, Sparkles, ArrowRight, CheckCircle2, ShoppingCart, 
  Wallet, Clock, BarChart3, Wrench, Package, Users, Landmark,
  Shield, Cloud, HelpCircle, CornerDownLeft
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

interface FAQItem {
  titulo: string;
  keywords: string[];
  resposta: string;
  acao?: { label: string; tab: string };
}

const FAQ_KNOWLEDGE_BASE: FAQItem[] = [
  // 1. Financeiro & Tesouraria (Cofre Central)
  {
    titulo: 'Módulo Financeiro & Tesouraria',
    keywords: ['financeiro', 'tesouraria', 'cofre', 'cofre central', 'modulo financeiro', 'gestao financeira'],
    resposta: 'O módulo Financeiro & Tesouraria centraliza todo o fluxo de dinheiro físico da empresa:\n• Cofre Central: guarda o saldo em espécie da loja para abertura de gavetas;\n• Rastreabilidade total: todo fundo de troco inicial sai do cofre e todo dinheiro apurado no fechamento retorna para o cofre;\n• Aportes e Retiradas: permite injetar capital no cofre ou registrar retiradas para depósito bancário/despesas;\n• Auditoria Contábil: extrato cronológico completo com exportação em planilha Excel (.csv).',
    acao: { label: 'Acessar Financeiro & Cofre', tab: 'financeiro' }
  },
  {
    titulo: 'De onde vem o fundo de troco?',
    keywords: ['fundo de troco', 'origem do fundo', 'abertura com 100', 'de onde vem o dinheiro', 'dinheiro da abertura', 'troco inicial'],
    resposta: 'No nosso sistema contábil integrado:\n1. Ao abrir o caixa com um valor inicial (ex: R$ 100,00), o sistema debita automaticamente esse valor do Cofre Central da empresa sob a rubrica "Liberação de Fundo de Troco";\n2. Esse valor entra na gaveta do operador para compor o troco;\n3. Ao encerrar o turno e fechar o caixa, todo o dinheiro apurado na gaveta (fundo + vendas em dinheiro) é recolhido e creditado de volta no Cofre Central!',
    acao: { label: 'Ver Cofre no Financeiro', tab: 'financeiro' }
  },
  {
    titulo: 'Fechamento de Caixa e Retorno ao Cofre',
    keywords: ['fechamento cofre', 'fechar caixa dinheiro', 'para onde vai o dinheiro', 'recolhimento', 'fechar caixa'],
    resposta: 'Ao realizar o fechamento do caixa:\n1. O operador informa o valor físico contado na gaveta;\n2. O sistema audita quebras ou sobras comparando com o saldo esperado calculado;\n3. O valor em espécie apurado é automaticamente recolhido para a Tesouraria e creditado no Cofre Central sob o evento "Recolhimento de Fechamento de Caixa";\n4. Dessa forma, a empresa mantém 100% de controle sobre o dinheiro vivo!',
    acao: { label: 'Ir para Controle de Caixa', tab: 'caixa' }
  },
  {
    titulo: 'Aporte de Capital e Retirada Bancária',
    keywords: ['aporte', 'retirada', 'deposito bancario', 'colocar dinheiro no cofre', 'tirar dinheiro do cofre', 'despesa cofre'],
    resposta: 'Na tela de Financeiro & Cofre você conta com botões rápidos:\n• "+ Aporte no Cofre": registra entrada de dinheiro vivo na empresa (ex: sócios colocando capital ou saque bancário para reforço);\n• "- Retirada / Depósito": registra retirada física do cofre para depósito na conta bancária ou pagamento de despesa em espécie com validação de saldo disponível.',
    acao: { label: 'Abrir Financeiro', tab: 'financeiro' }
  },
  {
    titulo: 'Perfil Financeiro',
    keywords: ['perfil financeiro', 'cargo financeiro', 'usuario financeiro', 'permissoes financeiro'],
    resposta: 'O perfil "FINANCEIRO" foi criado para segregação de funções em empresas estruturadas:\n• Acesso Total à Tesouraria e Cofre Central;\n• Auditoria de todos os caixas da empresa e aprovação de sangrias/suprimentos;\n• Consulta aos relatórios de faturamento geral da empresa;\n• Sem acesso operacional ao balcão PDV (não atua como operador de caixa vendedor).',
    acao: { label: 'Gestão da Equipe & Usuários', tab: 'usuarios' }
  },

  // 2. Caixa & Operação
  {
    titulo: 'Como abrir e fechar o caixa',
    keywords: ['abrir caixa', 'fechar caixa', 'abertura de caixa', 'como abrir caixa', 'como fechar caixa'],
    resposta: 'No menu "Controle de Caixa":\n• Abertura: informe o valor do fundo de troco inicial e clique em "Abrir Caixa Agora";\n• Operação: o sistema monitora em tempo real vendas em dinheiro, PIX, cartões e crediário;\n• Fechamento: clique em "Fechar Caixa", digite o valor contado fisicamente na gaveta e confirme. O sistema calcula a quebra/sobra e devolve o dinheiro ao cofre.',
    acao: { label: 'Abrir Controle de Caixa', tab: 'caixa' }
  },
  {
    titulo: 'Sangria, Suprimento e Sangria Cega',
    keywords: ['sangria', 'suprimento', 'sangria cega', 'limite gaveta', 'excedeu limite'],
    resposta: 'Gestão de numerário na gaveta do caixa:\n• Suprimento: solicitação de troco adicional (sai do cofre central para a gaveta);\n• Sangria: retirada de excesso de dinheiro físico (sai da gaveta e entra no cofre central);\n• Limite Seguro de Gaveta: quando o dinheiro em notas ultrapassa o teto definido, o sistema emite alerta vermelho recomendando sangria;\n• Sangria Cega: o Gestor/Admin pode exigir a sangria imediata sem que o operador visualize o saldo em tela.',
    acao: { label: 'Ir para Controle de Caixa', tab: 'caixa' }
  },
  {
    titulo: 'Identificação do Dono do Caixa',
    keywords: ['dono do caixa', 'conta proprietaria', 'quem abriu o caixa', 'responsavel pelo caixa'],
    resposta: 'Na listagem e auditoria de caixas (menu Controle de Caixa):\n• O Administrador e o Financeiro visualizam os cards de todos os caixas em operação com identificação clara do operador responsável (nome, e-mail e cargo);\n• Cada caixa registra horário exato de abertura, terminal e tempo decorrido de atendimento.',
    acao: { label: 'Inspecionar Caixas', tab: 'caixa' }
  },

  // 3. Frente de Caixa (PDV)
  {
    titulo: 'Vendas no PDV e Código de Barras',
    keywords: ['vender', 'pdv', 'codigo de barras', 'bipar', 'frente de caixa', 'como vender'],
    resposta: 'No Frente de Caixa (PDV):\n• Digite o nome do item ou bipe o código de barras com leitor óptico (pressione Enter para adicionar instantaneamente);\n• Clique nos produtos em destaque para inclusão rápida;\n• Ajuste quantidades usando os botões "+" e "-" no carrinho;\n• Pressione "F2" ou clique em "Finalizar Venda" para abrir a tela de recebimento.',
    acao: { label: 'Ir para Frente de Caixa (PDV)', tab: 'pdv' }
  },
  {
    titulo: 'Como aplicar Desconto no PDV',
    keywords: ['desconto', 'aplicar desconto', 'desconto em porcentagem', 'desconto em reais', 'desconto porcento', 'desconto %'],
    resposta: 'O PDV conta com o Seletor Moderno de Desconto:\n1. No carrinho de compras, localize a seção de desconto;\n2. Escolha a modalidade clicando em "R$ (Valor Fixo)" ou "% (Porcentagem)";\n3. Digite o valor desejado (ex: 10 para R$ 10,00 ou 10 para 10%);\n4. O sistema recalcula o subtotal líquido e atualiza o cupom fiscal imediatamente.',
    acao: { label: 'Testar no PDV', tab: 'pdv' }
  },
  {
    titulo: 'Formas de Pagamento e Troco',
    keywords: ['formas de pagamento', 'troco', 'pix', 'cartao', 'dinheiro', 'crediario', 'fiado', 'pagamento'],
    resposta: 'O sistema aceita 5 formas de pagamento:\n• Dinheiro: conta com atalhos de notas (+R$ 10, +R$ 50, Valor Exato) e cálculo automático de troco a devolver;\n• PIX: modal com instruções de conferência visual no extrato bancário antes da baixa;\n• Cartão de Crédito e Débito: maquininha física (POS/TEF);\n• A Prazo (Crediário): lança o débito diretamente na ficha cadastral do cliente no limite aprovado.',
    acao: { label: 'Ir para Frente de Caixa (PDV)', tab: 'pdv' }
  },
  {
    titulo: 'Comprovante Digital Térmico de 80mm',
    keywords: ['comprovante', 'recibo', 'nota digital', 'imprimir cupom', 'impressao termica', 'pagina em branco'],
    resposta: 'Todos os comprovantes do sistema (PDV, Ordens de Serviço, Quitação de Fiado e Fechamento de Caixa) utilizam o Comprovante Térmico Digital:\n• Abre como modal sobre a tela atual sem abrir abas em branco;\n• Exibe logomarca, CNPJ, dados da empresa, itens, operador e formas de pagamento;\n• O botão "Imprimir" dispara o driver de bobina térmica 80mm ou PDF em segundo plano.',
    acao: { label: 'Ver Relatório de Vendas', tab: 'relatorios' }
  },
  {
    titulo: 'PDV no Celular (Responsividade Mobile)',
    keywords: ['celular', 'mobile', 'responsividade', 'pdv celular', 'usar no celular', 'responsivo'],
    resposta: 'O sistema foi adaptado ao Padrão de Mercado Mobile:\n• Em celulares, o PDV separa as telas em duas abas no topo: "[ 📦 Catálogo ]" e "[ 🛒 Carrinho ]";\n• Ao adicionar produtos pelo celular, uma barra flutuante inferior surge mostrando o totalizador e o botão "Ver Carrinho / Cobrar ➔";\n• Elimina completamente o aperto de tela e rolagens desconfortáveis no smartphone.',
    acao: { label: 'Abrir PDV', tab: 'pdv' }
  },

  // 4. Ordens de Serviço (OS) & Segmentos
  {
    titulo: 'Ordens de Serviço por Segmento Comercial',
    keywords: ['ordem de servico', 'os', 'servico', 'mecanica', 'adega', 'lava rapido', 'segmento os', 'nova os'],
    resposta: 'As Ordens de Serviço adaptam termos e campos automaticamente ao segmento da sua empresa:\n• Adega & Bebidas: "Encomendas / Reservas de Bebidas" para festas e consignação de barris;\n• Lava Rápido & Estética: "Ordens de Serviço Automotivas" com placa e modelo do veículo no box;\n• Oficina Mecânica: atendimentos mecânicos com defeito relatado, laudo técnico e peças aplicadas;\n• Construtora / Depósito: "Cargas & Entregas na Obra" com controle de frete e descarregamento;\n• Faturamento: você pode cobrar a OS na própria tela de OS ou importá-la para o PDV.',
    acao: { label: 'Ir para Ordens de Serviço', tab: 'os' }
  },
  {
    titulo: 'Fluxo de Atendimento da Ordem de Serviço',
    keywords: ['fluxo os', 'status os', 'concluir os', 'faturar os', 'cobrar os', 'etapas os'],
    resposta: 'O fluxo de uma OS percorre as seguintes fases:\n1. Aberta: solicitação cadastrada aguardando início;\n2. Em Andamento: serviço em execução pela equipe;\n3. Aguardando Peças: atendimento pausado aguardando insumos;\n4. Concluída: serviço finalizado com sucesso! Liberada para cobrança;\n5. Entregue & Faturada: recebimento registrado no caixa e recibo emitido ao cliente.',
    acao: { label: 'Ver Ordens de Serviço', tab: 'os' }
  },

  // 5. Ponto Eletrônico CLT
  {
    titulo: 'Ponto Eletrônico CLT & Artigos 66 e 59',
    keywords: ['ponto', 'bater ponto', 'ponto clt', 'art 66', 'art 59', 'horas extras', 'interjornada', 'jornada'],
    resposta: 'O módulo de Ponto Eletrônico foi projetado conforme a legislação trabalhista brasileira (CLT):\n• 4 batidas diárias: 1ª Entrada, 2ª Saída para Almoço, 3ª Retorno do Almoço e 4ª Saída do Turno;\n• Artigo 66 da CLT: monitora o descanso interjornada mínimo de 11 horas consecutivas entre dois dias de trabalho;\n• Artigo 59 da CLT: limita a no máximo 2 horas extras por dia, gerando alerta de auditoria para o Gestor;\n• Bloqueio Legal: impede colaboradores sem registro de entrada de operar o caixa ou realizar vendas.',
    acao: { label: 'Acessar Ponto Eletrônico', tab: 'ponto' }
  },
  {
    titulo: 'Bypass de Teste do Ponto',
    keywords: ['bypass', 'bypass ponto', 'ponto teste', 'bloqueio ponto', 'desbloquear ponto'],
    resposta: 'Para facilitar testes e demonstrações sem restrições de horário:\n• O Administrador pode ativar o "Bypass de Ponto de Teste" através do botão no topo da tela de Ponto Eletrônico;\n• Com o bypass ativado, operadores de caixa e estoquistas podem testar todas as funcionalidades do sistema livremente sem exigir batidas reais de ponto.',
    acao: { label: 'Configurar Ponto Eletrônico', tab: 'ponto' }
  },

  // 6. Produtos & Estoque
  {
    titulo: 'Produtos, Dashboard de Estoque e Margem de Lucro',
    keywords: ['produtos', 'estoque', 'cadastrar produto', 'patrimonio', 'margem de lucro', 'reposicao'],
    resposta: 'No menu "Produtos & Estoque":\n• Cadastro completo: código de barras, categoria, preço de custo, preço de venda e estoque mínimo;\n• Dashboard Patrimonial: calcula patrimônio total a preço de custo, projeção de venda bruta e margem média de lucro da loja;\n• Sugestão de Reposição: alerta automático de mercadorias esgotadas ou com estoque crítico;\n• Histórico de Movimentações: rastreia todas as entradas, saídas e balanços de estoque com operador e motivo.',
    acao: { label: 'Abrir Produtos & Estoque', tab: 'produtos' }
  },
  {
    titulo: 'Controlador de Estoque (Estoquista)',
    keywords: ['estoquista', 'controlador de estoque', 'funcao estoquista'],
    resposta: 'O colaborador com cargo "Controlador de Estoque":\n• Atua exclusivamente no módulo de Produtos & Estoque;\n• Realiza contagem, balanço e entrada de mercadorias com justificativa;\n• Não tem acesso a vendas no PDV, controle de caixas nem financeiro, garantindo a integridade patrimonial do estoque da empresa.',
    acao: { label: 'Ver Gestão de Estoque', tab: 'produtos' }
  },

  // 7. Clientes & Crediário
  {
    titulo: 'Clientes, Crediário e Fiado Seguro',
    keywords: ['cliente', 'clientes', 'fiado', 'crediario', 'limite de credito', 'saldo devedor', 'quitar debito'],
    resposta: 'No módulo "Clientes & Crediário":\n• Cadastro completo com CPF/CNPJ, telefone WhatsApp e endereço;\n• Limite de Crédito: define o teto máximo que o cliente pode comprar fiado;\n• Saldo Devedor: acumula automaticamente compras realizadas na opção "A Prazo" no PDV;\n• Quitação de Débito: o cliente pode pagar dívidas diretamente no caixa com recibo e liberação imediata do limite.',
    acao: { label: 'Ir para Clientes & Crediário', tab: 'clientes' }
  },

  // 8. Relatórios de Vendas
  {
    titulo: 'Relatórios de Vendas, Exportação Excel e Cancelamento',
    keywords: ['relatorio', 'relatorios', 'excel', 'exportar excel', 'cancelar venda', 'estornar venda'],
    resposta: 'No módulo "Relatórios de Vendas":\n• Filtros flexíveis por data, operador vendedor, cliente e forma de pagamento;\n• Exportação para Excel (.csv com formatação brasileira e separador por ponto e vírgula);\n• Relatório Web Executivo (HTML) pronto para impressão;\n• Cancelamento de Venda: permite estornar uma venda indevida, devolvendo automaticamente as quantidades de cada item para o estoque físico.',
    acao: { label: 'Ver Relatórios de Vendas', tab: 'relatorios' }
  },

  // 9. Equipe, Usuários e Cargos
  {
    titulo: 'Perfis de Usuários e Níveis de Acesso',
    keywords: ['usuarios', 'equipe', 'cargos', 'perfis', 'gerente', 'operador', 'permissoes', 'trocar senha'],
    resposta: 'O sistema disponibiliza 6 perfis de acesso:\n1. Gerente Geral (ADMIN): acesso irrestrito e configurações da empresa;\n2. Financeiro & Tesouraria (FINANCEIRO): gestão do cofre, auditoria de caixa e relatórios;\n3. Operador de Caixa (OPERADOR_CAIXA): opera PDV, caixa e ordens de serviço;\n4. Controlador de Estoque (ESTOQUISTA): focado em inventário e balanço;\n5. Vendedor Comercial: balcão e atendimento a clientes;\n6. Técnico: execução de serviços e ordens de trabalho.',
    acao: { label: 'Gerenciar Equipe', tab: 'usuarios' }
  },

  // 10. Dados da Empresa, Temas e Cloudflare R2
  {
    titulo: 'Personalização Visual e Cloudflare R2 Bucket',
    keywords: ['empresa', 'logo', 'r2', 'cloudflare', 'bucket', 'tema', 'cores', 'paleta', 'sobre empresa'],
    resposta: 'No menu "Dados da Empresa":\n• Personalização Temática: escolha entre 6 paletas visuais (Safira, Âmbar, Ciano, Esmeralda, Vinho Púrpura, Rubi);\n• Armazenamento em Nuvem Cloudflare R2: integração nativa com o bucket "sistema-gestao-prd" para fotos de colaboradores e logotipo com CDN global ultrarrápida;\n• Dados Cadastrais: razão social, nome fantasia, CNPJ, telefone, e-mail comercial e endereço com CEP.',
    acao: { label: 'Configurar Empresa', tab: 'empresa' }
  },

  // 11. Atalhos de Teclado
  {
    titulo: 'Atalhos de Teclado para Agilidade',
    keywords: ['atalhos', 'teclado', 'teclas', 'f2', 'atalho finalizar', 'enter'],
    resposta: 'Principais atalhos para agilizar o atendimento no balcão:\n• F2: abre instantaneamente o modal de finalização/pagamento da venda no PDV;\n• Enter (no campo de busca): adiciona diretamente o produto encontrado ao carrinho;\n• Esc: fecha modais abertos, comprovantes térmicos e telas de confirmação;\n• Tab / Shift+Tab: navega entre os campos de digitação.',
    acao: { label: 'Abrir PDV', tab: 'pdv' }
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
      texto: `Olá! Sou o Assistente Inteligente do seu Sistema de Gestão Comercial.\n\nFui treinado com todas as funcionalidades da sua empresa: Tesouraria & Cofre Central, PDV, Caixa, Ponto CLT, Estoque, Ordens de Serviço, Clientes Fiado e Relatórios.\n\nComo posso ajudar seu expediente hoje?`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const endMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberto) {
      endMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagens, aberto, digitando]);

  const normalizar = (txt: string) => {
    return txt
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();
  };

  const processarPergunta = (pergunta: string) => {
    const qNorm = normalizar(pergunta);
    const palavrasPergunta = qNorm.split(/\s+/).filter(p => p.length >= 3);

    let melhorItem: FAQItem | null = null;
    let maiorPontuacao = 0;

    for (const item of FAQ_KNOWLEDGE_BASE) {
      let pontuacao = 0;

      // 1. Match exato de frase em alguma keyword (+50 pontos)
      for (const kw of item.keywords) {
        const kwNorm = normalizar(kw);
        if (qNorm === kwNorm) {
          pontuacao += 60;
        } else if (qNorm.includes(kwNorm)) {
          pontuacao += 30;
        } else if (kwNorm.includes(qNorm) && qNorm.length >= 4) {
          pontuacao += 20;
        }

        // 2. Match por palavras individuais (+5 pontos cada)
        const palavrasKw = kwNorm.split(/\s+/);
        for (const p of palavrasPergunta) {
          if (palavrasKw.includes(p)) {
            pontuacao += 8;
          } else if (palavrasKw.some(pk => pk.includes(p) || p.includes(pk))) {
            pontuacao += 4;
          }
        }
      }

      if (pontuacao > maiorPontuacao) {
        maiorPontuacao = pontuacao;
        melhorItem = item;
      }
    }

    if (melhorItem && maiorPontuacao >= 8) {
      return {
        resposta: melhorItem.resposta,
        acao: melhorItem.acao
      };
    }

    // Resposta padrão caso não localize termo específico
    return {
      resposta: `Entendi sua dúvida sobre "${pergunta}".\n\nNosso sistema contempla módulos completos de:\n• Tesouraria & Cofre Central (gestão do dinheiro e fundos de troco)\n• Controle de Caixa (abertura, sangrias, suprimentos e auditoria)\n• Frente de Caixa (PDV rápido com leitor de código de barras e desconto)\n• Ordens de Serviço (personalizadas por segmento comercial)\n• Ponto Eletrônico CLT (4 batidas e intervalo interjornada de 11h)\n• Produtos & Estoque (dashboard patrimonial e balanço)\n• Clientes & Fiado (limite de crédito e quitação de dívidas)\n• Relatórios de Vendas (exportação em Excel e cancelamentos)\n\nVocê pode me perguntar diretamente sobre qualquer um desses temas ou clicar no botão abaixo para explorar!`,
      acao: { label: 'Fazer Tour Guiado pelo Sistema', tab: 'tour' }
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
    }, 400);
  };

  const handleAcaoBotao = (tab: string) => {
    if (tab === 'tour' && onOpenTour) {
      onOpenTour();
    } else if (onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  // Sugestões Rápidas de Dúvidas
  const sugestoesChips = [
    'De onde vem o fundo de troco?',
    'Como funciona o Cofre e Tesouraria?',
    'Como aplicar desconto no PDV?',
    'O que é o perfil Financeiro?',
    'Onde bater ponto CLT e Art. 66?',
    'Como cancelar uma venda no estoque?',
    'Como funcionam as Ordens de Serviço?',
    'Como exportar relatório em Excel?'
  ];

  return (
    <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50">
      {/* Botão Flutuante Elegante no Padrão de Mercado */}
      {!aberto && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className={`group relative flex items-center gap-2.5 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full bg-gradient-to-r ${temaAtual.bgGradiente} text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all border-2 border-white/60 cursor-pointer backdrop-blur-xs`}
          title="Assistente IA do Sistema - Clique para tirar dúvidas"
          aria-label="Abrir Assistente IA"
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot size={20} className="drop-shadow-xs" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
          </div>
          <div className="text-left hidden xs:block">
            <span className="text-xs font-bold leading-none flex items-center gap-1">
              <span>Assistente IA</span>
              <Sparkles size={12} className="text-amber-300 animate-bounce" />
            </span>
            <span className="text-[10px] text-white/85 leading-tight block mt-0.5">Tirar dúvidas do sistema</span>
          </div>
        </button>
      )}

      {/* Janela de Chat Aberta */}
      {aberto && (
        <div className="w-[calc(100vw-2rem)] max-w-sm sm:w-[410px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col h-[560px] max-h-[85vh] overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* Header do Chat */}
          <div className={`p-4 bg-gradient-to-r ${temaAtual.bgGradiente} text-white flex items-center justify-between shadow-xs shrink-0`}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-xs shadow-inner">
                <Bot size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  <span>IA Operacional & Financeira</span>
                  <Sparkles size={13} className="text-amber-300" />
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[10px] text-white/85">Especialista no Sistema & Normas CLT</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setAberto(false)}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Fechar chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Sugestões Rápidas de Perguntas */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[10px] shrink-0">
            {sugestoesChips.map((sugestao, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleEnviarMensagem(sugestao)}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 whitespace-nowrap shadow-2xs transition-colors shrink-0 flex items-center gap-1"
              >
                <span>{sugestao}</span>
              </button>
            ))}
          </div>

          {/* Histórico de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50 text-xs">
            {mensagens.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] p-3.5 rounded-2xl leading-relaxed shadow-2xs ${
                    msg.sender === 'user'
                      ? `bg-gradient-to-r ${temaAtual.bgGradiente} text-white rounded-br-xs`
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.texto}</p>

                  {/* Ação Interativa no Chat */}
                  {msg.acao && (
                    <button
                      type="button"
                      onClick={() => handleAcaoBotao(msg.acao!.tab)}
                      className="mt-3 w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-colors shadow-2xs active:scale-95 cursor-pointer"
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
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] p-2.5 bg-white rounded-2xl w-fit border border-slate-100 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                <span className="ml-1 text-[10px] font-medium">Consultando sistema...</span>
              </div>
            )}
            <div ref={endMessagesRef} />
          </div>

          {/* Input de Envio */}
          <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0">
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
              placeholder="Pergunte sobre cofre, troco, vendas, CLT, caixa..."
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => handleEnviarMensagem()}
              disabled={!inputTexto.trim()}
              className={`p-2.5 rounded-xl text-white transition-all disabled:opacity-40 bg-gradient-to-r ${temaAtual.bgGradiente} shadow-xs cursor-pointer`}
              title="Enviar mensagem"
            >
              <Send size={15} />
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
