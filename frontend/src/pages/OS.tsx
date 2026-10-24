import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiService } from '../services/api';
import { OrdemServico, Cliente, Produto, StatusOS, FormaPagamento, Caixa, Venda } from '../types';
import { ComprovanteDigitalModal } from '../components/ComprovanteDigitalModal';
import { 
  Wrench, Plus, Search, Clock, CheckCircle2, 
  AlertCircle, ChevronRight, User, Calendar, Edit, Package,
  CreditCard, Banknote, QrCode, UserCheck, Receipt, Printer,
  Sparkles, RefreshCw, X, AlertTriangle, Check, Copy
} from 'lucide-react';

export const OS: React.FC = () => {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');

  // Clientes e produtos para nova OS
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [caixaAtual, setCaixaAtual] = useState<Caixa | null>(null);

  // Modais
  const [modalNovaOS, setModalNovaOS] = useState(false);
  const [modalDetalheOS, setModalDetalheOS] = useState<OrdemServico | null>(null);

  // Modal Cobrança / Faturamento
  const [modalCobrarOS, setModalCobrarOS] = useState<OrdemServico | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('DINHEIRO');
  const [valorRecebido, setValorRecebido] = useState<string>('');
  const [desconto, setDesconto] = useState<number>(0);
  const [observacoes, setObservacoes] = useState<string>('');
  const [faturando, setFaturando] = useState(false);
  const [erroFaturamento, setErroFaturamento] = useState<string | null>(null);
  const [sucessoFaturamento, setSucessoFaturamento] = useState<{
    os: OrdemServico;
    venda_id: number;
    valor_pago: number;
    forma_pagamento: string;
  } | null>(null);
  const [comprovanteVenda, setComprovanteVenda] = useState<Venda | null>(null);

  // PIX Mercado Pago na OS
  const [pixData, setPixData] = useState<{
    payment_id: string;
    qr_code?: string;
    status: string;
  } | null>(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [pixCopiado, setPixCopiado] = useState(false);

  // Form states nova OS
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [titulo, setTitulo] = useState('');
  const [equipamento, setEquipamento] = useState('');
  const [defeitoRelatado, setDefeitoRelatado] = useState('');
  const [valorServicos, setValorServicos] = useState<number>(0);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const osList = await apiService.listarOS(filtroStatus !== 'TODOS' ? (filtroStatus as StatusOS) : undefined);
      setOrdens(osList);
      const clis = await apiService.listarClientes();
      setClientes(clis);
      const prods = await apiService.listarProdutos();
      setProdutos(prods);
      try {
        const c = await apiService.getCaixaAtual();
        setCaixaAtual(c);
      } catch (e) {
        console.warn('Caixa atual não encontrado:', e);
      }
    } catch (err) {
      console.error('Erro ao carregar OS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [filtroStatus]);

  const handleCriarOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || !titulo) return;

    try {
      await apiService.criarOS({
        cliente_id: Number(clienteId),
        titulo,
        equipamento,
        defeito_relatado: defeitoRelatado,
        valor_servicos: valorServicos
      });
      setModalNovaOS(false);
      setTitulo('');
      setEquipamento('');
      setDefeitoRelatado('');
      setValorServicos(0);
      setClienteId('');
      carregarDados();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao criar ordem de serviço');
    }
  };

  const handleAtualizarStatus = async (osId: number, novoStatus: StatusOS) => {
    try {
      await apiService.atualizarOS(osId, { status: novoStatus });
      if (modalDetalheOS && modalDetalheOS.id === osId) {
        setModalDetalheOS({ ...modalDetalheOS, status: novoStatus });
      }
      carregarDados();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao atualizar status');
    }
  };

  const handleAbrirCobrar = async (os: OrdemServico) => {
    setModalCobrarOS(os);
    setFormaPagamento('DINHEIRO');
    setDesconto(0);
    setObservacoes('');
    setValorRecebido(Number(os.valor_total).toFixed(2));
    setErroFaturamento(null);
    setPixData(null);
    try {
      const c = await apiService.getCaixaAtual();
      setCaixaAtual(c);
    } catch (e) {
      setCaixaAtual(null);
    }
  };

  const handleGerarPixMercadoPago = async () => {
    if (!modalCobrarOS) return;
    const totalCobrar = Math.max(0, Number(modalCobrarOS.valor_total) - desconto);
    setGerandoPix(true);
    setErroFaturamento(null);
    try {
      const res = await apiService.gerarPixQRCode({
        valor: totalCobrar,
        descricao: `OS #${modalCobrarOS.id} - ${modalCobrarOS.titulo}`,
        cliente_nome: modalCobrarOS.cliente_nome
      });
      setPixData(res);
    } catch (err: any) {
      setErroFaturamento(err.response?.data?.detail || 'Erro ao gerar cobrança PIX Mercado Pago');
    } finally {
      setGerandoPix(false);
    }
  };

  const handleConfirmarFaturamento = async () => {
    if (!modalCobrarOS) return;
    if (!caixaAtual) {
      alert('Você precisa abrir o caixa operacional antes de receber pagamentos!');
      return;
    }

    const totalCobrar = Math.max(0, Number(modalCobrarOS.valor_total) - desconto);
    let valorPagoNum = parseFloat(valorRecebido) || totalCobrar;

    if (formaPagamento !== 'DINHEIRO') {
      valorPagoNum = totalCobrar;
    }

    if (valorPagoNum < totalCobrar) {
      setErroFaturamento(`O valor informado (R$ ${valorPagoNum.toFixed(2)}) é menor que o valor a cobrar (R$ ${totalCobrar.toFixed(2)}).`);
      return;
    }

    const troco = formaPagamento === 'DINHEIRO' ? Math.max(0, valorPagoNum - totalCobrar) : 0;

    setFaturando(true);
    setErroFaturamento(null);
    try {
      const res = await apiService.faturarOS(modalCobrarOS.id, {
        caixa_id: caixaAtual.id,
        pagamentos: [
          {
            forma_pagamento: formaPagamento,
            valor: valorPagoNum,
            troco: troco
          }
        ],
        desconto: desconto,
        observacoes: observacoes || undefined
      });

      setSucessoFaturamento({
        os: res.os,
        venda_id: res.venda_id,
        valor_pago: totalCobrar,
        forma_pagamento: formaPagamento
      });
      setModalCobrarOS(null);
      carregarDados();
    } catch (err: any) {
      setErroFaturamento(err.response?.data?.detail || 'Erro ao faturar ordem de serviço');
    } finally {
      setFaturando(false);
    }
  };

  const handleCopiarPix = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setPixCopiado(true);
      setTimeout(() => setPixCopiado(false), 2500);
    }
  };

  const formatMoney = (val: number = 0) => {
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const statusColors: Record<StatusOS, { bg: string; text: string; label: string }> = {
    ABERTA: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Aberta' },
    EM_ANDAMENTO: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Em Andamento' },
    AGUARDANDO_PECAS: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Aguardando Peças' },
    CONCLUIDA: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Concluída' },
    ENTREGUE: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Entregue / Faturada' },
    CANCELADA: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Cancelada' },
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Ordens de Serviço (OS) & Faturamento</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie atendimentos técnicos, controle peças aplicadas e realize a cobrança direta no caixa com recibo.
          </p>
        </div>

        <button
          onClick={() => setModalNovaOS(true)}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus size={16} />
          <span>Nova Ordem de Serviço</span>
        </button>
      </div>

      {/* Filtros por Status */}
      <div className="flex flex-wrap gap-2">
        {['TODOS', 'ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_PECAS', 'CONCLUIDA', 'ENTREGUE'].map(st => (
          <button
            key={st}
            onClick={() => setFiltroStatus(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filtroStatus === st
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {st === 'TODOS' ? 'Todas as OS' : statusColors[st as StatusOS]?.label || st}
          </button>
        ))}
      </div>

      {/* Lista de Ordens de Serviço */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ordens.length === 0 ? (
          <div className="col-span-full bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            Nenhuma ordem de serviço encontrada.
          </div>
        ) : (
          ordens.map((os) => {
            const st = statusColors[os.status] || { bg: 'bg-slate-50', text: 'text-slate-700', label: os.status };
            const podeCobrar = os.status !== 'ENTREGUE' && os.status !== 'CANCELADA';

            return (
              <div
                key={os.id}
                onClick={() => setModalDetalheOS(os)}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-sky-400 cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-400">OS #{os.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${st.bg} ${st.text}`}>
                      {st.label}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mb-1 leading-snug">{os.titulo}</h3>
                  {os.equipamento && (
                    <p className="text-xs font-medium text-sky-700 mb-2">{os.equipamento}</p>
                  )}

                  <div className="space-y-1 text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <User size={13} className="text-slate-400" />
                      <span className="font-medium text-slate-700 truncate">{os.cliente_nome}</span>
                    </div>
                    {os.defeito_relatado && (
                      <p className="text-slate-500 line-clamp-2 text-[11px] italic bg-slate-50 p-2 rounded-lg mt-2">
                        "{os.defeito_relatado}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                    <span className="font-bold text-slate-800 text-sm">{formatMoney(os.valor_total)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {podeCobrar && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAbrirCobrar(os);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1 transition-all"
                      >
                        <CreditCard size={13} />
                        <span>Cobrar</span>
                      </button>
                    )}
                    <div className="flex items-center gap-0.5 text-xs font-semibold text-slate-500 hover:text-sky-600">
                      <span>Ver</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Nova OS com Fechamento ao Clicar Fora */}
      {modalNovaOS && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalNovaOS(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base leading-tight">Nova Ordem de Serviço</h3>
              <button
                type="button"
                onClick={() => setModalNovaOS(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCriarOS} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cliente *</label>
                <select
                  required
                  value={clienteId}
                  onChange={(e) => setClienteId(Number(e.target.value) || '')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Selecione o cliente...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} ({c.telefone || 'Sem tel'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título do Serviço / Resumo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Troca de óleo e revisão de suspensão"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Veículo / Equipamento</label>
                <input
                  type="text"
                  placeholder="Ex: Honda Civic 2.0 - Placa ABC-1234"
                  value={equipamento}
                  onChange={(e) => setEquipamento(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Defeito Relatado pelo Cliente</label>
                <textarea
                  rows={2}
                  placeholder="Descreva o que o cliente informou..."
                  value={defeitoRelatado}
                  onChange={(e) => setDefeitoRelatado(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Valor da Mão de Obra / Serviço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={valorServicos || ''}
                  onChange={(e) => setValorServicos(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalNovaOS(false)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold text-sm shadow-xs"
                >
                  Abrir Ordem de Serviço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalhes da OS com Fechamento ao Clicar Fora */}
      {modalDetalheOS && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalDetalheOS(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-400">OS #{modalDetalheOS.id}</span>
                <h3 className="font-bold text-slate-800 text-lg leading-tight">{modalDetalheOS.titulo}</h3>
              </div>
              <button
                onClick={() => setModalDetalheOS(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <p><strong>Cliente:</strong> {modalDetalheOS.cliente_nome}</p>
                <p><strong>Equipamento / Veículo:</strong> {modalDetalheOS.equipamento || 'Não especificado'}</p>
                <p><strong>Status Atual:</strong> {statusColors[modalDetalheOS.status]?.label}</p>
              </div>

              <div>
                <span className="block font-semibold text-slate-700 mb-1">Atualizar Status do Atendimento:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_PECAS', 'CONCLUIDA', 'ENTREGUE', 'CANCELADA'] as StatusOS[]).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleAtualizarStatus(modalDetalheOS.id, st)}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                        modalDetalheOS.status === st
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {statusColors[st]?.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mão de Obra / Serviços:</span>
                  <span className="font-semibold text-slate-800">{formatMoney(modalDetalheOS.valor_servicos)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Peças & Insumos Utilizados:</span>
                  <span className="font-semibold text-slate-800">{formatMoney(modalDetalheOS.valor_pecas)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-700">Valor Total da OS:</span>
                  <span className="text-lg font-black text-emerald-600">{formatMoney(modalDetalheOS.valor_total)}</span>
                </div>
              </div>
            </div>

            {modalDetalheOS.status !== 'ENTREGUE' && modalDetalheOS.status !== 'CANCELADA' && (
              <button
                type="button"
                onClick={() => {
                  const os = modalDetalheOS;
                  setModalDetalheOS(null);
                  handleAbrirCobrar(os);
                }}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <CreditCard size={18} />
                <span>Cobrar e Finalizar OS ({formatMoney(modalDetalheOS.valor_total)})</span>
              </button>
            )}

            <button
              onClick={() => setModalDetalheOS(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal Cobrança / Recebimento da OS com Fechamento ao Clicar Fora */}
      {modalCobrarOS && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalCobrarOS(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">
                  Recebimento de Atendimento
                </span>
                <h3 className="text-lg font-black text-slate-900 leading-tight">
                  Cobrar Ordem de Serviço #{modalCobrarOS.id}
                </h3>
              </div>
              <button
                onClick={() => setModalCobrarOS(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Aviso de Caixa Fechado se houver */}
            {!caixaAtual && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                <span>Seu caixa não está aberto. Abra seu caixa para registrar os recebimentos.</span>
              </div>
            )}

            {/* Resumo de Valores */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-bold text-slate-800">{modalCobrarOS.cliente_nome}</span>
              </div>
              {modalCobrarOS.equipamento && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Veículo / Equipamento:</span>
                  <span className="font-semibold text-slate-700">{modalCobrarOS.equipamento}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Mão de Obra + Peças:</span>
                <span className="font-medium text-slate-700">{formatMoney(modalCobrarOS.valor_total)}</span>
              </div>
              {desconto > 0 && (
                <div className="flex items-center justify-between text-xs text-rose-600 font-semibold">
                  <span>Desconto Concedido:</span>
                  <span>- {formatMoney(desconto)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase">Total a Cobrar:</span>
                <span className="text-2xl font-black text-emerald-600">
                  {formatMoney(Math.max(0, Number(modalCobrarOS.valor_total) - desconto))}
                </span>
              </div>
            </div>

            {/* Formas de Pagamento */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Selecione a Forma de Pagamento</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
                  { id: 'PIX', label: 'PIX Mercado Pago', icon: QrCode },
                  { id: 'CARTAO_CREDITO', label: 'Crédito', icon: CreditCard },
                  { id: 'CARTAO_DEBITO', label: 'Débito', icon: CreditCard },
                  { id: 'A_PRAZO', label: 'A Prazo (Crediário)', icon: UserCheck },
                ].map((fp) => {
                  const Icon = fp.icon;
                  const isSel = formaPagamento === fp.id;
                  return (
                    <button
                      key={fp.id}
                      type="button"
                      onClick={() => setFormaPagamento(fp.id as FormaPagamento)}
                      className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition-all ${
                        isSel
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <Icon size={18} className={isSel ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className="text-[11px] leading-tight">{fp.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Painel Específico da Forma de Pagamento */}
            {formaPagamento === 'DINHEIRO' && (
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-emerald-900">Valor Entregue pelo Cliente (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    className="w-32 px-2.5 py-1.5 border border-emerald-300 rounded-lg font-bold text-right text-emerald-900 focus:outline-none"
                  />
                </div>
                {parseFloat(valorRecebido) > Math.max(0, Number(modalCobrarOS.valor_total) - desconto) && (
                  <div className="flex justify-between items-center pt-1 font-bold text-emerald-800">
                    <span>Troco a Devolver:</span>
                    <span className="text-sm">
                      {formatMoney(parseFloat(valorRecebido) - Math.max(0, Number(modalCobrarOS.valor_total) - desconto))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {formaPagamento === 'PIX' && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
                {!pixData ? (
                  <div>
                    <p className="text-xs text-slate-600 mb-3">
                      Gere o QR Code dinâmico do Mercado Pago para o cliente escanear e pagar instantaneamente.
                    </p>
                    <button
                      type="button"
                      disabled={gerandoPix}
                      onClick={handleGerarPixMercadoPago}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                    >
                      <Sparkles size={15} />
                      <span>{gerandoPix ? 'Gerando QR Code...' : 'Gerar QR Code PIX'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="inline-block p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <QRCodeSVG
                        value={
                          pixData.qr_code ||
                          `00020126580014BR.GOV.BCB.PIX0136${pixData.payment_id}-os5204000053039865405${Number(modalCobrarOS?.valor_total || 0).toFixed(2)}5802BR5925GESTAO PME6009SAO PAULO62070503***6304`
                        }
                        size={160}
                        level="M"
                        includeMargin={true}
                        className="rounded-lg shadow-2xs"
                      />
                    </div>

                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={handleCopiarPix}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        {pixCopiado ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        <span>{pixCopiado ? 'Chave Copiada!' : 'Copiar Pix Copia e Cola'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {formaPagamento === 'A_PRAZO' && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <UserCheck size={14} /> Venda Faturada no Crediário do Cliente
                </p>
                <p className="text-[11px] text-amber-700">
                  O valor será acrescido no saldo devedor de <strong>{modalCobrarOS.cliente_nome}</strong> e poderá ser quitado posteriormente.
                </p>
              </div>
            )}

            {/* Desconto */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Desconto (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={desconto || ''}
                  onChange={(e) => setDesconto(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações no Recibo</label>
                <input
                  type="text"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Garantia de 90 dias"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {erroFaturamento && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{erroFaturamento}</span>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalCobrarOS(null)}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={faturando || !caixaAtual}
                onClick={handleConfirmarFaturamento}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {faturando ? (
                  <span>Faturando...</span>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Confirmar e Emitir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Recibo de Sucesso da OS com Fechamento ao Clicar Fora */}
      {sucessoFaturamento && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSucessoFaturamento(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-center space-y-4 border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Pagamento Registrado com Sucesso!</h3>
              <p className="text-xs text-slate-500 mt-1">
                A OS foi concluída e o valor foi integrado diretamente ao caixa.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Ordem de Serviço:</span>
                <span className="font-bold text-slate-800">#{sucessoFaturamento.os.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Venda Gerada:</span>
                <span className="font-bold text-sky-700">#{sucessoFaturamento.venda_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cliente:</span>
                <span className="font-semibold text-slate-800">{sucessoFaturamento.os.cliente_nome}</span>
              </div>
              {sucessoFaturamento.os.equipamento && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Veículo / Equipamento:</span>
                  <span className="font-medium text-slate-700">{sucessoFaturamento.os.equipamento}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Forma de Pagamento:</span>
                <span className="font-semibold text-emerald-700">{sucessoFaturamento.forma_pagamento}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                <span className="font-bold text-slate-700">Total Pago:</span>
                <span className="font-black text-emerald-600">{formatMoney(sucessoFaturamento.valor_pago)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (sucessoFaturamento) {
                    const vendaMontada: Venda = {
                      id: sucessoFaturamento.venda_id,
                      empresa_id: sucessoFaturamento.os.empresa_id || 1,
                      caixa_id: caixaAtual?.id || 1,
                      usuario_id: 1,
                      usuario_nome: 'Atendimento OS',
                      cliente_id: sucessoFaturamento.os.cliente_id,
                      cliente_nome: sucessoFaturamento.os.cliente_nome,
                      status: 'CONCLUIDA',
                      valor_bruto: sucessoFaturamento.valor_pago,
                      desconto: 0,
                      acrescimo: 0,
                      valor_liquido: sucessoFaturamento.valor_pago,
                      created_at: new Date().toISOString(),
                      itens: (sucessoFaturamento.os.itens || []).map(i => ({
                        id: i.id || 0,
                        produto_id: i.produto_id || 0,
                        produto_nome: i.produto_nome || `Item #${i.produto_id}`,
                        quantidade: i.quantidade,
                        valor_unitario: i.valor_unitario,
                        subtotal: i.subtotal
                      })),
                      pagamentos: [{
                        id: 1,
                        forma_pagamento: sucessoFaturamento.forma_pagamento as any,
                        valor: sucessoFaturamento.valor_pago,
                        troco: 0
                      }]
                    };
                    setComprovanteVenda(vendaMontada);
                  }
                }}
                className="flex-1 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Receipt size={15} />
                <span>Ver Comprovante Digital</span>
              </button>
              <button
                type="button"
                onClick={() => setSucessoFaturamento(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sobre a Tela de Comprovante Digital */}
      <ComprovanteDigitalModal
        isOpen={!!comprovanteVenda}
        onClose={() => setComprovanteVenda(null)}
        venda={comprovanteVenda}
      />
    </div>
  );
};
