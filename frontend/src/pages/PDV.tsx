import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiService } from '../services/api';
import { Produto, Cliente, Caixa, FormaPagamento, StatusJornada, Venda } from '../types';
import { useNotificacoes } from '../contexts/NotificationContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { useToast } from '../contexts/ToastContext';
import { ComprovanteDigitalModal } from '../components/ComprovanteDigitalModal';
import { 
  Search, Barcode, Trash2, Plus, Minus, CreditCard, 
  Banknote, QrCode, UserCheck, CheckCircle2, AlertCircle, 
  ShoppingCart, RefreshCw, X, Copy, Check, Sparkles, Wrench,
  Lock, Clock, Receipt, Shield, AlertTriangle, Smartphone
} from 'lucide-react';

interface CartItem {
  produto: Produto;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
  is_servico_os?: boolean;
  is_peca_os?: boolean;
  baixar_estoque?: boolean;
  os_id?: number;
}

export const PDV: React.FC = () => {
  const { addNotificacao } = useNotificacoes();
  const { toast } = useToast();

  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [carregandoCaixa, setCarregandoCaixa] = useState(true);
  const [saldoInicialAbertura, setSaldoInicialAbertura] = useState<number>(0);

  // Produtos e Busca
  const [busca, setBusca] = useState('');
  const [produtosSugestoes, setProdutosSugestoes] = useState<Produto[]>([]);
  const [todosProdutos, setTodosProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);

  // Carrinho
  const [carrinho, setCarrinho] = useState<CartItem[]>([]);
  const [desconto, setDesconto] = useState<number>(0);
  const [acrescimo, setAcrescimo] = useState<number>(0);

  // Modal de Checkout / Pagamento
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('DINHEIRO');
  const [valorRecebido, setValorRecebido] = useState<string>('');
  const [sucessoVenda, setSucessoVenda] = useState<any | null>(null);
  const [erroCheckout, setErroCheckout] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  // PIX State
  const [pixData, setPixData] = useState<{
    payment_id: string;
    qr_code?: string;
    qr_code_base64?: string;
    qr_svg?: string;
    status: string;
    modo: string;
  } | null>(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [pixCopiado, setPixCopiado] = useState(false);

  // Cartão (maquininha física)
  const [pointData, setPointData] = useState<{ id: string; status: string; modo: string } | null>(null);
  const [aguardandoPoint, setAguardandoPoint] = useState(false);
  const [pointIntentId, setPointIntentId] = useState<string | null>(null);

  // Importar Ordem de Serviço para o Carrinho
  const [modalImportarOSAberto, setModalImportarOSAberto] = useState(false);
  const [ordensServicoPendentes, setOrdensServicoPendentes] = useState<any[]>([]);
  const [carregandoOS, setCarregandoOS] = useState(false);
  const [osVinculadaId, setOsVinculadaId] = useState<number | null>(null);

  const { temaAtual } = useEmpresa();
  const [modalComprovanteAberto, setModalComprovanteAberto] = useState(false);
  const [statusPonto, setStatusPonto] = useState<StatusJornada | null>(null);

  const checarStatusPonto = async () => {
    try {
      const sp = await apiService.getStatusPontoHoje();
      setStatusPonto(sp);
    } catch {
      // Falha silenciosa se não autenticado
    }
  };

  useEffect(() => {
    checarStatusPonto();
    const interval = setInterval(checarStatusPonto, 30000);
    return () => clearInterval(interval);
  }, []);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Carrega caixa atual e produtos base
  const inicializarPDV = async () => {
    setCarregandoCaixa(true);
    try {
      const c = await apiService.getCaixaAtual();
      setCaixa(c);
      const prods = await apiService.listarProdutos();
      setTodosProdutos(prods);
      const clis = await apiService.listarClientes();
      setClientes(clis);
    } catch (err) {
      console.error('Erro ao inicializar PDV:', err);
    } finally {
      setLoadingCaixa(false);
    }
  };

  const setLoadingCaixa = (val: boolean) => setCarregandoCaixa(val);

  useEffect(() => {
    inicializarPDV();
  }, []);

  // Busca de produtos com debounce simples
  useEffect(() => {
    if (!busca.trim()) {
      setProdutosSugestoes([]);
      return;
    }
    const termo = busca.toLowerCase();
    const filtrados = todosProdutos.filter(
      p => p.nome.toLowerCase().includes(termo) || (p.codigo_barras && p.codigo_barras.includes(termo))
    ).slice(0, 8);
    setProdutosSugestoes(filtrados);
  }, [busca, todosProdutos]);

  const handleAbrirModalImportarOS = async () => {
    setCarregandoOS(true);
    setModalImportarOSAberto(true);
    try {
      const ordens = await apiService.listarOS();
      const concluidas = ordens.filter(o => o.status === 'CONCLUIDA');
      setOrdensServicoPendentes(concluidas);
    } catch (e) {
      console.error('Erro ao buscar OS pendentes:', e);
    } finally {
      setCarregandoOS(false);
    }
  };

  const handleCarregarOSParaCarrinho = (os: any) => {
    // Vincula o cliente da OS
    const cli = clientes.find(c => c.id === os.cliente_id) || null;
    if (cli) {
      setClienteSelecionado(cli);
    }
    setOsVinculadaId(os.id);

    const novosItens: CartItem[] = [];

    // Mão de obra / serviços da OS
    if (Number(os.valor_servicos) > 0) {
      novosItens.push({
        produto: {
          id: 999000 + os.id,
          empresa_id: 1,
          nome: `Serviço OS #${os.id}: ${os.titulo}`,
          preco_venda: Number(os.valor_servicos),
          preco_custo: 0,
          estoque_atual: 999,
          estoque_minimo: 0,
          unidade: 'UN',
          codigo_barras: `OS-${os.id}`,
          ativo: true
        },
        quantidade: 1,
        valor_unitario: Number(os.valor_servicos),
        subtotal: Number(os.valor_servicos),
        is_servico_os: true,
        baixar_estoque: false,
        os_id: os.id
      });
    }

    // Peças vinculadas
    if (os.itens && os.itens.length > 0) {
      os.itens.forEach((it: any) => {
        novosItens.push({
          produto: {
            id: it.produto_id,
            empresa_id: 1,
            nome: it.produto_nome || `Peça OS #${it.produto_id}`,
            preco_venda: Number(it.valor_unitario),
            preco_custo: 0,
            estoque_atual: 999,
            estoque_minimo: 0,
            unidade: 'UN',
            codigo_barras: `PEC-${it.produto_id}`,
            ativo: true
          },
          quantidade: Number(it.quantidade),
          valor_unitario: Number(it.valor_unitario),
          subtotal: Number(it.subtotal),
          is_peca_os: true,
          baixar_estoque: false,
          os_id: os.id
        });
      });
    }

    setCarrinho(prev => [...prev, ...novosItens]);
    setModalImportarOSAberto(false);
    addNotificacao({
      tipo: 'sucesso',
      titulo: 'OS Importada',
      mensagem: `Ordem de Serviço #${os.id} adicionada ao carrinho.`,
    });
  };

  const handleAbrirCaixa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const novoCaixa = await apiService.abrirCaixa(saldoInicialAbertura, 'Abertura rápida no PDV');
      setCaixa(novoCaixa);
      toast.sucesso('Caixa aberto com sucesso no PDV!');
    } catch (err: any) {
      toast.erro(err.response?.data?.detail || 'Erro ao abrir caixa');
    }
  };

  const adicionarAoCarrinho = (produto: Produto) => {
    // Validação de estoque zerado
    if (produto.estoque_atual <= 0) {
      toast.aviso(`Estoque esgotado para '${produto.nome}'. Não é possível adicionar ao carrinho.`);
      addNotificacao({
        tipo: 'erro',
        titulo: 'Estoque Insuficiente',
        mensagem: `Produto: ${produto.nome}. Disponível: 0 unidades`,
      });
      return;
    }

    // Validação de quantidade já no carrinho
    const itemExistente = carrinho.find(item => item.produto.id === produto.id);
    if (itemExistente && (itemExistente.quantidade + 1) > produto.estoque_atual) {
      toast.aviso(`Quantidade solicitada supera o estoque disponível (${produto.estoque_atual} disponível)`);
      addNotificacao({
        tipo: 'erro',
        titulo: 'Estoque Insuficiente',
        mensagem: `Produto: ${produto.nome}. Disponível: ${produto.estoque_atual} unidades`,
      });
      return;
    }

    setCarrinho(prev => {
      const index = prev.findIndex(item => item.produto.id === produto.id);
      if (index >= 0) {
        const novo = [...prev];
        const novaQtd = novo[index].quantidade + 1;
        novo[index] = {
          ...novo[index],
          quantidade: novaQtd,
          subtotal: novaQtd * novo[index].valor_unitario
        };
        return novo;
      } else {
        return [
          ...prev,
          {
            produto,
            quantidade: 1,
            valor_unitario: Number(produto.preco_venda),
            subtotal: Number(produto.preco_venda)
          }
        ];
      }
    });
    setBusca('');
    setProdutosSugestoes([]);
    searchInputRef.current?.focus();
  };

  const alterarQuantidade = (index: number, delta: number) => {
    setCarrinho(prev => {
      const novo = [...prev];
      const novaQtd = novo[index].quantidade + delta;
      if (novaQtd <= 0) {
        return novo.filter((_, i) => i !== index);
      }
      novo[index] = {
        ...novo[index],
        quantidade: novaQtd,
        subtotal: novaQtd * novo[index].valor_unitario
      };
      return novo;
    });
  };

  const removerItem = (index: number) => {
    setCarrinho(prev => prev.filter((_, i) => i !== index));
  };

  // Cálculos financeiros
  const subtotalBruto = carrinho.reduce((acc, it) => acc + it.subtotal, 0);
  const totalLiquido = Math.max(0, subtotalBruto - (Number(desconto) || 0) + (Number(acrescimo) || 0));

  const numRecebido = Number(valorRecebido) || 0;
  const troco = formaPagamento === 'DINHEIRO' && numRecebido > totalLiquido ? numRecebido - totalLiquido : 0;

  // Para botão de finalizar: desabilita para DINHEIRO se valor insuficiente
  const podeFinalizar = (() => {
    if (finalizando) return false;
    if (formaPagamento === 'A_PRAZO' && !clienteSelecionado) return false;
    if (formaPagamento === 'DINHEIRO') {
      return valorRecebido !== '' && numRecebido >= totalLiquido;
    }
    return true;
  })();

  const abrirModalPagamento = async () => {
    if (carrinho.length === 0) return;
    try {
      const c = await apiService.getCaixaAtual().catch(() => null);
      if (c) {
        setCaixa(c);
      }
    } catch {}
    setValorRecebido('');
    setPixData(null);
    setPointData(null);
    setAguardandoPoint(false);
    setPointIntentId(null);
    setErroCheckout(null);
    setModalPagamentoAberto(true);
  };

  const handleGerarPixMercadoPago = async () => {
    setGerandoPix(true);
    setErroCheckout(null);
    try {
      const dados = await apiService.gerarPixQRCode({
        valor: totalLiquido,
        descricao: `Venda PDV - ${carrinho.length} item(ns)`,
        cliente_email: clienteSelecionado?.email || undefined,
        cliente_nome: clienteSelecionado?.nome || undefined
      });
      setPixData(dados);
    } catch (err: any) {
      setErroCheckout(err.response?.data?.detail || 'Erro ao gerar cobrança PIX.');
    } finally {
      setGerandoPix(false);
    }
  };

  const handleSimularAprovacaoPix = async () => {
    if (!pixData) return;
    try {
      await apiService.simularAprovacaoPix(pixData.payment_id);
      setPixData({ ...pixData, status: 'approved' });
      addNotificacao({
        tipo: 'sucesso',
        titulo: 'PIX Recebido!',
        mensagem: 'Pagamento confirmado. Venda finalizada.',
      });
      // Finaliza venda automaticamente
      handleFinalizarVenda();
    } catch (err: any) {
      toast.erro('Erro ao simular aprovação do PIX');
    }
  };

  const handleCopiarPix = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setPixCopiado(true);
      setTimeout(() => setPixCopiado(false), 2500);
    }
  };

  const handleEnviarParaMaquininha = async () => {
    setAguardandoPoint(false);
    setErroCheckout(null);
    try {
      const res = await apiService.criarIntencaoCartao(totalLiquido, 'Venda PDV');
      setPointData({ id: res.id, status: res.status || 'PENDING', modo: res.modo || 'PRODUCAO' });
      setPointIntentId(res.id);
      setAguardandoPoint(true);
    } catch (err: any) {
      setErroCheckout(err.response?.data?.detail || 'Erro ao enviar para a maquininha.');
    }
  };

  const handleSimularAprovacaoPoint = async () => {
    if (!pointIntentId) return;
    try {
      await apiService.simularAprovacaoPoint(pointIntentId);
      setPointData(prev => prev ? { ...prev, status: 'APPROVED' } : null);
      setAguardandoPoint(false);
      addNotificacao({
        tipo: 'sucesso',
        titulo: 'Pagamento Aprovado!',
        mensagem: 'Cartão aprovado na maquininha. Venda finalizada.',
      });
      handleFinalizarVenda();
    } catch (err: any) {
      toast.erro('Erro ao simular aprovação na maquininha');
    }
  };

  const handleFinalizarVenda = async () => {
    let caixaAtivo = caixa;
    try {
      const c = await apiService.getCaixaAtual().catch(() => null);
      if (c) {
        caixaAtivo = c;
        setCaixa(c);
      }
    } catch {}

    if (!caixaAtivo) {
      setErroCheckout('Nenhum caixa aberto encontrado para registrar a venda. Abra o caixa antes de continuar.');
      return;
    }

    if (formaPagamento === 'A_PRAZO' && !clienteSelecionado) {
      const msg = 'Selecione um cliente cadastrado para registrar a venda a prazo.';
      setErroCheckout(msg);
      toast.aviso(msg);
      return;
    }

    setFinalizando(true);
    setErroCheckout(null);

    try {
      const dadosVenda = {
        caixa_id: caixaAtivo.id,
        cliente_id: clienteSelecionado ? clienteSelecionado.id : null,
        desconto: Number(desconto) || 0,
        acrescimo: Number(acrescimo) || 0,
        os_id: osVinculadaId || undefined,
        itens: carrinho.map(it => ({
          produto_id: it.produto.id,
          quantidade: it.quantidade,
          valor_unitario: it.valor_unitario,
          is_servico_os: !!it.is_servico_os,
          is_peca_os: !!it.is_peca_os,
          baixar_estoque: it.baixar_estoque !== false,
          os_id: it.os_id || osVinculadaId || undefined
        })),
        pagamentos: [
          {
            forma_pagamento: formaPagamento,
            valor: totalLiquido,
            troco: troco
          }
        ]
      };

      const vendaRealizada = await apiService.registrarVenda(dadosVenda);
      setSucessoVenda(vendaRealizada);
      setModalPagamentoAberto(false);
      setCarrinho([]);
      setDesconto(0);
      setAcrescimo(0);
      setClienteSelecionado(null);
      setOsVinculadaId(null);
      setPixData(null);
      setPointData(null);
      setAguardandoPoint(false);
      setPointIntentId(null);
      addNotificacao({
        tipo: 'sucesso',
        titulo: 'Venda Realizada',
        mensagem: `Venda no valor de ${formatMoney(totalLiquido)} concluída com sucesso.`,
      });
      // Atualiza produtos em estoque
      const prods = await apiService.listarProdutos();
      setTodosProdutos(prods);
    } catch (err: any) {
      let msg = 'Erro ao processar a venda.';
      if (err.response?.data?.detail) {
        const d = err.response.data.detail;
        if (typeof d === 'string') {
          msg = d;
        } else if (Array.isArray(d)) {
          msg = d.map((it: any) => it.msg || JSON.stringify(it)).join(' | ');
        } else if (typeof d === 'object') {
          msg = JSON.stringify(d);
        }
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (typeof err.response?.data === 'string' && err.response.data.trim()) {
        msg = err.response.data;
      } else if (err.message) {
        msg = err.message;
      }
      setErroCheckout(msg);
      toast.erro(msg);
    } finally {
      setFinalizando(false);
    }
  };

  const formatMoney = (val: number) => {
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatEstoque = (val: number = 0) => {
    const num = Number(val);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
  };

  if (carregandoCaixa) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  const usuarioSalvo = localStorage.getItem('gestao_user') || sessionStorage.getItem('gestao_user');
  const usuarioLogado = usuarioSalvo ? JSON.parse(usuarioSalvo) : null;
  const isAdmin = usuarioLogado?.perfil === 'ADMIN';

  // Trava Inteligente CLT: se estourou jornada e não está no meio de venda, bloqueia terminal (exceto Administrador/Gestor - Art. 62 CLT)
  if (!isAdmin && statusPonto?.bloqueado_clt && carrinho.length === 0) {
    return (
      <div className="min-h-[500px] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl max-w-lg w-full p-8 text-center border-2 border-rose-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
            <Lock size={32} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
              Proteção Trabalhista CLT (Art. 59)
            </span>
            <h2 className="text-2xl font-black text-slate-800 mt-2">Frente de Caixa Travado</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Sua jornada de trabalho legal foi encerrada ou atingiu o limite de horas extras permitidas pela legislação trabalhista. 
              Para continuar operando vendas, solicite ao <strong>Administrador</strong> a liberação formal de horas extras no módulo de Ponto.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-left space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Tempo Trabalhado Hoje:</span>
              <span className="font-bold text-slate-800">
                {Math.floor((statusPonto.minutos_trabalhados || 0) / 60)}h {(statusPonto.minutos_trabalhados || 0) % 60}m
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Hora Extra Autorizada:</span>
              <span className="font-bold text-amber-600">{statusPonto.hora_extra_autorizada || 0} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status Legal:</span>
              <span className="font-bold text-rose-600">Bloqueio Automático Ativo</span>
            </div>
          </div>

          <button
            onClick={checarStatusPonto}
            className={`w-full py-3 bg-gradient-to-r ${temaAtual.bgGradiente} hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2`}
          >
            <RefreshCw size={15} />
            <span>Verificar Autorização do Administrador</span>
          </button>
        </div>
      </div>
    );
  }

  // Se o caixa estiver fechado, exibe tela de abertura obrigatória
  if (!caixa) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Caixa Fechado</h2>
        <p className="text-slate-500 text-sm mt-1 mb-6">
          Para realizar vendas no PDV, é necessário abrir o caixa do dia informando o saldo inicial (fundo de troco).
        </p>

        <form onSubmit={handleAbrirCaixa} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">
              Saldo Inicial / Fundo de Troco (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={saldoInicialAbertura}
              onChange={(e) => setSaldoInicialAbertura(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-lg font-semibold"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-xl shadow-md shadow-sky-600/20 transition-colors"
          >
            Abrir Caixa Agora
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-5">
      {/* Coluna Esquerda: Busca & Catálogo Rápido */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Barra de Busca de Produtos */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search size={19} />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && produtosSugestoes.length > 0) {
                  adicionarAoCarrinho(produtosSugestoes[0]);
                }
              }}
              placeholder="Digite o nome do produto ou bip o código de barras (Enter para adicionar)..."
              className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent shadow-xs"
              autoFocus
            />
            {busca && (
              <button 
                onClick={() => setBusca('')} 
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Lista Flutuante de Sugestões de Busca */}
          {produtosSugestoes.length > 0 && (
            <div className="absolute z-20 left-4 right-4 lg:right-auto lg:w-[500px] mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100">
              {produtosSugestoes.map((p) => (
                <div
                  key={p.id}
                  onClick={() => adicionarAoCarrinho(p)}
                  className="p-3 hover:bg-sky-50 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.nome}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{p.codigo_barras || 'Sem código'}</span>
                      <span>•</span>
                      <span className={p.estoque_atual <= 0 ? 'text-rose-600 font-semibold' : ''}>
                        Estoque: {p.estoque_atual} {p.unidade}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-sky-600">{formatMoney(p.preco_venda)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grade de Produtos Frequentes / Rápidos */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Produtos em Destaque
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {todosProdutos.map((prod) => (
              <button
                key={prod.id}
                onClick={() => adicionarAoCarrinho(prod)}
                className="p-3 bg-white border border-slate-200 hover:border-sky-500 hover:bg-sky-50/30 rounded-xl text-left transition-all group flex flex-col justify-between shadow-xs hover:shadow-sm"
              >
                <div>
                  <span className="text-[10px] font-semibold text-sky-600 uppercase tracking-wide">
                    {prod.categoria || 'Geral'}
                  </span>
                  <h5 className="text-xs font-medium text-slate-800 group-hover:text-sky-700 line-clamp-2 mt-0.5">
                    {prod.nome}
                  </h5>
                </div>
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-900">{formatMoney(prod.preco_venda)}</span>
                  <span className="text-[10px] text-slate-400">Est: {formatEstoque(prod.estoque_atual)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Coluna Direita: Carrinho & Checkout */}
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Header do Carrinho & Cliente */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-sky-600" />
              <h3 className="font-bold text-slate-800 text-sm">Itens da Venda</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAbrirModalImportarOS}
                className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-sky-200"
                title="Cobrar Ordem de Serviço em aberto"
              >
                <Wrench size={12} />
                <span>Cobrar OS</span>
              </button>
              <span className="text-xs bg-sky-100 text-sky-700 font-semibold px-2 py-0.5 rounded-full">
                {carrinho.reduce((acc, it) => acc + it.quantidade, 0)} itens
              </span>
            </div>
          </div>

          {/* Selecionar Cliente */}
          <div className="relative">
            <select
              value={clienteSelecionado ? String(clienteSelecionado.id) : ''}
              onChange={(e) => {
                const val = e.target.value;
                const found = clientes.find(c => String(c.id) === String(val)) || null;
                setClienteSelecionado(found);
              }}
              className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-sky-500 focus:outline-none"
            >
              <option value="">Consumidor Final (Sem cadastro)</option>
              {clientes.map(c => (
                <option key={c.id} value={String(c.id)}>
                  {c.nome} {c.saldo_devedor > 0 ? `(Devedor: ${formatMoney(c.saldo_devedor)})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista de Itens no Carrinho */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-100">
          {carrinho.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12 text-center">
              <ShoppingCart size={36} className="text-slate-300 mb-2" />
              <p className="text-xs font-medium">Carrinho vazio</p>
              <p className="text-[11px] text-slate-400">Bipe ou clique em um produto para adicionar</p>
            </div>
          ) : (
            carrinho.map((item, index) => (
              <div key={item.produto.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{item.produto.nome}</p>
                  <p className="text-[11px] text-slate-400">
                    {item.quantidade} x {formatMoney(item.valor_unitario)}
                  </p>
                </div>

                {/* Controles de Quantidade */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => alterarQuantidade(index, -1)}
                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-xs"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-5 text-center text-xs font-semibold">{item.quantidade}</span>
                  <button
                    onClick={() => alterarQuantidade(index, 1)}
                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-xs"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                <div className="text-right min-w-[70px]">
                  <p className="text-xs font-bold text-slate-800">{formatMoney(item.subtotal)}</p>
                  <button
                    onClick={() => removerItem(index)}
                    className="text-[10px] text-rose-500 hover:text-rose-700"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totais e Botão de Cobrar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/80 space-y-2.5">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Subtotal</span>
            <span>{formatMoney(subtotalBruto)}</span>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-600">Desconto (R$)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={desconto || ''}
              onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
              placeholder="0,00"
              className="w-20 px-2 py-1 text-right bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
            <span className="text-sm font-bold text-slate-800">TOTAL</span>
            <span className="text-2xl font-black text-sky-600">{formatMoney(totalLiquido)}</span>
          </div>

          <button
            onClick={abrirModalPagamento}
            disabled={carrinho.length === 0}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-base shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Banknote size={20} />
            <span>Finalizar Venda (F2)</span>
          </button>
        </div>
      </div>

      {/* Modal de Pagamento / Checkout com Fechamento ao Clicar Fora */}
      {modalPagamentoAberto && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalPagamentoAberto(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800 text-lg">Recebimento da Venda</h3>
              <button 
                onClick={() => setModalPagamentoAberto(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            {erroCheckout && (
              <div className="my-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{erroCheckout}</span>
              </div>
            )}

            <div className="my-4 text-center p-4 bg-sky-50/60 rounded-xl border border-sky-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor a Receber</span>
              <p className="text-3xl font-black text-sky-700 mt-1">{formatMoney(totalLiquido)}</p>
            </div>

            {/* Formas de Pagamento */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
              {[
                { id: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
                { id: 'PIX', label: 'PIX', icon: QrCode },
                { id: 'CARTAO_CREDITO', label: 'Crédito', icon: CreditCard },
                { id: 'CARTAO_DEBITO', label: 'Débito', icon: CreditCard },
                { id: 'A_PRAZO', label: 'A Prazo (Crediário)', icon: UserCheck },
              ].map(forma => {
                const Icon = forma.icon;
                const isSelected = formaPagamento === forma.id;
                return (
                  <button
                    key={forma.id}
                    type="button"
                    onClick={() => {
                      setFormaPagamento(forma.id as FormaPagamento);
                      setPixData(null);
                      setPointData(null);
                      setAguardandoPoint(false);
                      setPointIntentId(null);
                    }}
                    className={`
                      p-3 rounded-xl border flex flex-col items-center gap-2 transition-all text-xs font-semibold
                      ${isSelected 
                        ? 'border-sky-600 bg-sky-50 text-sky-700 shadow-xs' 
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }
                    `}
                  >
                    <Icon size={20} className={isSelected ? 'text-sky-600' : 'text-slate-400'} />
                    <span>{forma.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Confirmação de Pagamento PIX (Baixa Manual pelo Operador) */}
            {formaPagamento === 'PIX' && (
              <div className="p-4 bg-sky-50/70 rounded-2xl border border-sky-200 text-center mb-5 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center mx-auto shadow-inner">
                  <Smartphone size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Recebimento via PIX (Balcão)</h4>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                    Solicite que o cliente realize o pagamento utilizando a chave PIX ou o QR Code físico do estabelecimento.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Aguardando operador conferir o recebimento e dar baixa</span>
                </div>
              </div>
            )}

            {/* Confirmação de Pagamento em Cartão (Maquininha Física da Loja) */}
            {(formaPagamento === 'CARTAO_CREDITO' || formaPagamento === 'CARTAO_DEBITO') && (
              <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 text-center mb-5 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto shadow-inner">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Pagamento em Cartão ({formaPagamento === 'CARTAO_CREDITO' ? 'Crédito' : 'Débito'})
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                    Insira, aproxime ou passe o cartão na maquininha física da loja (POS/TEF).
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Aguardando comprovante da maquininha para dar baixa</span>
                </div>
              </div>
            )}

            {/* Calculadora de Troco — Dinheiro */}
            {formaPagamento === 'DINHEIRO' && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5 mb-5">
                {/* Botões de cédulas rápidas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-600">Atalhos de Valor / Cédulas:</p>
                    <button
                      type="button"
                      onClick={() => setValorRecebido(totalLiquido.toFixed(2))}
                      className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold rounded-lg transition-colors border border-emerald-300 flex items-center gap-1 shadow-2xs"
                    >
                      <CheckCircle2 size={13} />
                      <span>Valor Exato ({formatMoney(totalLiquido)})</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[5, 10, 20, 50, 100, 200].map(cedula => (
                      <button
                        key={cedula}
                        type="button"
                        onClick={() =>
                          setValorRecebido(prev => {
                            const atual = parseFloat(prev) || 0;
                            return (atual + cedula).toFixed(2);
                          })
                        }
                        className="px-3 py-1.5 bg-white border border-slate-300 hover:border-sky-500 hover:bg-sky-50 text-slate-700 text-xs font-bold rounded-lg transition-colors shadow-2xs"
                      >
                        + R$ {cedula}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Campo de entrada manual */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Valor Entregue pelo Cliente (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-lg font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                {/* Exibição do troco ou aviso de valor insuficiente */}
                {valorRecebido !== '' && (
                  <div className="pt-2 border-t border-slate-200">
                    {numRecebido >= totalLiquido ? (
                      <div className="flex justify-between items-center bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                        <span className="text-sm font-semibold text-emerald-800">Troco a Devolver:</span>
                        <span className="text-2xl font-black text-emerald-600">
                          {formatMoney(troco)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold text-rose-600 text-center py-1">
                        ⚠️ Valor entregue insuficiente (Faltam {formatMoney(totalLiquido - numRecebido)})
                      </p>
                    )}
                  </div>
                )}

                {/* Botão Limpar */}
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setValorRecebido('')}
                    className="text-xs text-slate-500 hover:text-slate-700 underline font-medium"
                  >
                    Limpar valor
                  </button>
                </div>
              </div>
            )}

            {/* Painel de Venda a Prazo (Crediário) com Seleção de Cliente e Limites */}
            {formaPagamento === 'A_PRAZO' && (
              <div className="mb-5 p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Cliente Vinculado para Lançamento do Crediário:
                  </label>
                  <select
                    value={clienteSelecionado ? String(clienteSelecionado.id) : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const found = clientes.find(c => String(c.id) === String(val)) || null;
                      setClienteSelecionado(found);
                    }}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="">Selecione o cliente cadastrado...</option>
                    {clientes.map(c => (
                      <option key={c.id} value={String(c.id)}>
                        {c.nome} {c.saldo_devedor > 0 ? `(Devedor: ${formatMoney(c.saldo_devedor)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {clienteSelecionado ? (
                  <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs space-y-1.5 shadow-2xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Limite de Crédito Aprovado:</span>
                      <span className="font-bold text-slate-800">{formatMoney(clienteSelecionado.limite_credito)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Débito Atual no Sistema:</span>
                      <span className="font-bold text-rose-600">{formatMoney(clienteSelecionado.saldo_devedor)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-1.5 font-bold">
                      <span className="text-slate-700">Novo Saldo Devedor Previsto:</span>
                      <span className="text-slate-900">{formatMoney(Number(clienteSelecionado.saldo_devedor) + totalLiquido)}</span>
                    </div>
                    {Number(clienteSelecionado.limite_credito) > 0 && (Number(clienteSelecionado.saldo_devedor) + totalLiquido) > Number(clienteSelecionado.limite_credito) && (
                      <p className="text-[11px] font-bold text-rose-600 mt-1 bg-rose-50 p-2 rounded-lg border border-rose-200">
                        ⚠️ Atenção: Esta venda de {formatMoney(totalLiquido)} ultrapassará o limite de crédito cadastrado de {formatMoney(clienteSelecionado.limite_credito)}.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-800 font-medium bg-amber-100/70 p-2.5 rounded-xl border border-amber-200">
                    ⚠️ Vendas a prazo necessitam de um cliente cadastrado selecionado para lançamento na ficha do crediário.
                  </p>
                )}
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModalPagamentoAberto(false)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-100 rounded-xl text-sm font-semibold text-slate-600 transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleFinalizarVenda}
                disabled={!podeFinalizar}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                <span>
                  {finalizando 
                    ? 'Dando Baixa...' 
                    : formaPagamento === 'PIX'
                      ? 'Confirmar Baixa do PIX'
                      : formaPagamento === 'CARTAO_CREDITO' || formaPagamento === 'CARTAO_DEBITO'
                        ? 'Confirmar Baixa no Cartão'
                        : formaPagamento === 'A_PRAZO'
                          ? 'Confirmar Venda a Prazo'
                          : 'Confirmar e Emitir'
                  }
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sucesso da Venda com Fechamento ao Clicar Fora */}
      {sucessoVenda && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSucessoVenda(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Venda Concluída!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Venda #{sucessoVenda.id} gravada com sucesso no caixa.
            </p>

            <div className="my-5 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-left text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Valor Total:</span>
                <span className="font-bold text-slate-800">{formatMoney(sucessoVenda.valor_liquido)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-medium text-slate-700">{sucessoVenda.cliente_nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Itens:</span>
                <span className="font-medium text-slate-700">{sucessoVenda.itens?.length || 0} produto(s)</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModalComprovanteAberto(true)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
              >
                <Receipt size={15} />
                <span>Ver Comprovante</span>
              </button>
              <button
                type="button"
                onClick={() => setSucessoVenda(null)}
                className={`flex-1 py-2.5 bg-gradient-to-r ${temaAtual.bgGradiente} text-white font-bold rounded-xl text-xs shadow-md transition-all`}
              >
                Nova Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprovante Digital Completo da Venda */}
      <ComprovanteDigitalModal
        isOpen={modalComprovanteAberto}
        onClose={() => setModalComprovanteAberto(false)}
        venda={sucessoVenda}
      />

      {/* Modal Selecionar OS para Cobrança no PDV com Fechamento ao Clicar Fora */}
      {modalImportarOSAberto && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalImportarOSAberto(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wrench className="text-sky-600" size={20} />
                <h3 className="font-bold text-slate-900 text-base">Ordens de Serviço Concluídas</h3>
              </div>
              <button
                onClick={() => setModalImportarOSAberto(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Apenas atendimentos técnicos <strong>Concluídos</strong> podem ser cobrados e faturados no caixa:
            </p>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {carregandoOS ? (
                <div className="text-center py-8 text-xs text-slate-400">Carregando ordens de serviço...</div>
              ) : ordensServicoPendentes.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 space-y-1.5 bg-slate-50 rounded-2xl p-4 border border-slate-200">
                  <p className="font-bold text-slate-700">Nenhuma OS concluída aguardando pagamento.</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Ordens em andamento não podem ser cobradas. Conclua a execução técnica na tela de Ordens de Serviço antes de realizar o faturamento no PDV.
                  </p>
                </div>
              ) : (
                ordensServicoPendentes.map((os) => (
                  <div
                    key={os.id}
                    onClick={() => handleCarregarOSParaCarrinho(os)}
                    className="p-3.5 bg-slate-50 hover:bg-sky-50/70 border border-slate-200 hover:border-sky-300 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-xs text-slate-500">#{os.id}</span>
                        <span className="font-bold text-slate-800 text-xs">{os.titulo}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Cliente: <strong className="text-slate-700">{os.cliente_nome}</strong>
                        {os.equipamento ? ` • ${os.equipamento}` : ''}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-emerald-600 block">
                        {formatMoney(os.valor_total)}
                      </span>
                      <span className="text-[10px] text-sky-600 font-bold hover:underline">
                        Carregar →
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setModalImportarOSAberto(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
