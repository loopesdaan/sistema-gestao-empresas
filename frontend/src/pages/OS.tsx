import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiService } from '../services/api';
import { OrdemServico, Cliente, Produto, StatusOS, FormaPagamento, Caixa, Venda, RelatorioCancelamentosOS } from '../types';
import { ComprovanteDigitalModal } from '../components/ComprovanteDigitalModal';
import { 
  Wrench, Plus, Search, Clock, CheckCircle2, 
  AlertCircle, ChevronRight, User, Calendar, Edit, Package,
  CreditCard, Banknote, QrCode, UserCheck, Receipt, Printer,
  Sparkles, RefreshCw, X, AlertTriangle, Check, Copy, Smartphone,
  Ban, FileText, Download, FileSpreadsheet, History
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

  // Modal Cancelamento de OS
  const [modalCancelarOS, setModalCancelarOS] = useState<OrdemServico | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [cancelandoOS, setCancelandoOS] = useState(false);

  // Modal Relatório de Cancelamentos
  const [modalRelatorioCancelamentosAberto, setModalRelatorioCancelamentosAberto] = useState(false);
  const [relatorioCancelamentos, setRelatorioCancelamentos] = useState<RelatorioCancelamentosOS | null>(null);
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);

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

  // PIX na OS
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
      const osAtualizada = await apiService.atualizarOS(osId, { status: novoStatus });
      if (modalDetalheOS && modalDetalheOS.id === osId) {
        setModalDetalheOS(osAtualizada);
      }
      carregarDados();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao atualizar status da OS');
    }
  };

  const handleAbrirCancelarOS = (os: OrdemServico, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setModalCancelarOS(os);
    setMotivoCancelamento('');
  };

  const handleConfirmarCancelamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCancelarOS) return;
    if (motivoCancelamento.trim().length < 5) {
      alert('Por favor, informe uma justificativa com no mínimo 5 caracteres.');
      return;
    }
    setCancelandoOS(true);
    try {
      await apiService.cancelarOS(modalCancelarOS.id, motivoCancelamento.trim());
      if (modalDetalheOS && modalDetalheOS.id === modalCancelarOS.id) {
        setModalDetalheOS(null);
      }
      setModalCancelarOS(null);
      setMotivoCancelamento('');
      carregarDados();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao cancelar ordem de serviço');
    } finally {
      setCancelandoOS(false);
    }
  };

  const handleAbrirRelatorioCancelamentos = async () => {
    setModalRelatorioCancelamentosAberto(true);
    setCarregandoRelatorio(true);
    try {
      const dados = await apiService.obterRelatorioCancelamentosOS();
      setRelatorioCancelamentos(dados);
    } catch (err: any) {
      console.error('Erro ao carregar relatório de cancelamentos:', err);
    } finally {
      setCarregandoRelatorio(false);
    }
  };

  const exportarCSVRelatorioCancelamentos = () => {
    if (!relatorioCancelamentos || !relatorioCancelamentos.ordens.length) return;
    let csv = '\ufeff'; // UTF-8 BOM
    csv += 'Número OS;Data Cancelamento;Cliente;Telefone;Veículo/Equipamento;Responsável Cancelamento;Motivo do Cancelamento;Mão de Obra (R$);Peças (R$);Total (R$)\n';
    relatorioCancelamentos.ordens.forEach(o => {
      const dataCanc = o.data_cancelamento ? new Date(o.data_cancelamento).toLocaleString('pt-BR') : '';
      const motivo = (o.motivo_cancelamento || '').replace(/;/g, ',');
      csv += `${o.id};"${dataCanc}";"${o.cliente_nome}";"${o.cliente_telefone || ''}";"${o.equipamento || ''}";"${o.usuario_cancelamento_nome || ''}";"${motivo}";${Number(o.valor_servicos).toFixed(2)};${Number(o.valor_pecas).toFixed(2)};${Number(o.valor_total).toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_cancelamentos_os_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAbrirCobrar = async (os: OrdemServico) => {
    if (os.status !== 'CONCLUIDA') {
      alert(`Apenas ordens com status 'Concluída' podem ser faturadas. O status atual é '${statusColors[os.status]?.label || os.status}'. Conclua a ordem antes de cobrar.`);
      return;
    }
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
      setErroFaturamento(err.response?.data?.detail || 'Erro ao gerar cobrança PIX');
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleAbrirRelatorioCancelamentos}
            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs transition-colors"
          >
            <Ban size={15} />
            <span>Relatório de Cancelamentos</span>
          </button>

          <button
            onClick={() => setModalNovaOS(true)}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <Plus size={16} />
            <span>Nova Ordem de Serviço</span>
          </button>
        </div>
      </div>

      {/* Filtros por Status */}
      <div className="flex flex-wrap gap-2">
        {['TODOS', 'ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_PECAS', 'CONCLUIDA', 'ENTREGUE', 'CANCELADA'].map(st => (
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
                    {os.status === 'CANCELADA' && os.motivo_cancelamento && (
                      <p className="text-rose-700 text-[11px] bg-rose-50 border border-rose-100 p-2 rounded-lg mt-2">
                        <strong>Motivo Cancelamento:</strong> {os.motivo_cancelamento}
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
                    {os.status === 'CONCLUIDA' && (
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

                    {os.status === 'EM_ANDAMENTO' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAtualizarStatus(os.id, 'CONCLUIDA');
                        }}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1 transition-all"
                        title="Concluir serviço para liberar cobrança no caixa"
                      >
                        <CheckCircle2 size={13} />
                        <span>Concluir</span>
                      </button>
                    )}

                    {os.status === 'ABERTA' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAtualizarStatus(os.id, 'EM_ANDAMENTO');
                        }}
                        className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1 transition-all"
                        title="Iniciar execução do serviço"
                      >
                        <Clock size={13} />
                        <span>Iniciar</span>
                      </button>
                    )}

                    {os.status === 'AGUARDANDO_PECAS' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAtualizarStatus(os.id, 'EM_ANDAMENTO');
                        }}
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1 transition-all"
                        title="Retomar execução do serviço"
                      >
                        <RefreshCw size={13} />
                        <span>Retomar</span>
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

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <p><strong>Cliente:</strong> {modalDetalheOS.cliente_nome}</p>
                <p><strong>Equipamento / Veículo:</strong> {modalDetalheOS.equipamento || 'Não especificado'}</p>
              </div>

              {/* Stepper Visual de Fases */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-500 uppercase tracking-wider">Etapa do Atendimento</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusColors[modalDetalheOS.status]?.bg} ${statusColors[modalDetalheOS.status]?.text}`}>
                    {statusColors[modalDetalheOS.status]?.label}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 py-1">
                  {[
                    { st: 'ABERTA', label: '1. Aberta', active: true },
                    { st: 'EM_ANDAMENTO', label: '2. Em Execução', active: ['EM_ANDAMENTO', 'AGUARDANDO_PECAS', 'CONCLUIDA', 'ENTREGUE'].includes(modalDetalheOS.status) },
                    { st: 'CONCLUIDA', label: '3. Concluída', active: ['CONCLUIDA', 'ENTREGUE'].includes(modalDetalheOS.status) },
                    { st: 'ENTREGUE', label: '4. Faturada', active: modalDetalheOS.status === 'ENTREGUE' }
                  ].map((passo, idx) => (
                    <div key={idx} className="flex flex-col items-center text-center">
                      <div className={`h-1.5 w-full rounded-full transition-all ${
                        modalDetalheOS.status === 'CANCELADA'
                          ? 'bg-rose-200'
                          : passo.active
                            ? 'bg-emerald-500'
                            : 'bg-slate-200'
                      }`} />
                      <span className={`text-[10px] mt-1 font-semibold ${
                        passo.active ? 'text-slate-900 font-bold' : 'text-slate-400'
                      }`}>
                        {passo.label}
                      </span>
                    </div>
                  ))}
                </div>

                {modalDetalheOS.status === 'AGUARDANDO_PECAS' && (
                  <div className="p-2 bg-purple-50 border border-purple-200 rounded-xl text-purple-700 text-xs flex items-center gap-1.5 font-medium">
                    <Clock size={14} className="shrink-0" />
                    <span>Atendimento pausado aguardando chegada de peças / insumos.</span>
                  </div>
                )}

                {modalDetalheOS.status === 'EM_ANDAMENTO' && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-1.5 font-medium">
                    <Clock size={14} className="shrink-0" />
                    <span>Serviço em execução. Conclua o atendimento técnico para liberar a cobrança.</span>
                  </div>
                )}

                {modalDetalheOS.status === 'ENTREGUE' && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-1.5 font-medium">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <span>Ordem faturada e entregue ao cliente. Histórico bloqueado para edições.</span>
                  </div>
                )}

                {modalDetalheOS.status === 'CANCELADA' && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-900">
                      <Ban size={15} className="shrink-0" />
                      <span>Ordem de Serviço Cancelada</span>
                    </div>
                    <p><strong>Motivo:</strong> {modalDetalheOS.motivo_cancelamento || 'Não informado'}</p>
                    {modalDetalheOS.data_cancelamento && (
                      <p className="text-[11px] text-rose-600">
                        Cancelada em {new Date(modalDetalheOS.data_cancelamento).toLocaleString('pt-BR')}
                        {modalDetalheOS.usuario_cancelamento_nome ? ` por ${modalDetalheOS.usuario_cancelamento_nome}` : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Transições de Status Permitidas */}
              {modalDetalheOS.status !== 'ENTREGUE' && modalDetalheOS.status !== 'CANCELADA' && (
                <div className="space-y-2 pt-1">
                  <span className="block font-semibold text-slate-700 text-xs">Avançar Etapa do Atendimento:</span>

                  {modalDetalheOS.status === 'ABERTA' && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => handleAtualizarStatus(modalDetalheOS.id, 'EM_ANDAMENTO')}
                        className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Clock size={15} />
                        <span>Iniciar Atendimento (Em Execução)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAtualizarStatus(modalDetalheOS.id, 'AGUARDANDO_PECAS')}
                        className="py-2.5 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl border border-purple-200 flex items-center justify-center gap-1 transition-all"
                      >
                        <Package size={15} />
                        <span>Aguardar Peças</span>
                      </button>
                    </div>
                  )}

                  {modalDetalheOS.status === 'AGUARDANDO_PECAS' && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => handleAtualizarStatus(modalDetalheOS.id, 'EM_ANDAMENTO')}
                        className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <CheckCircle2 size={15} />
                        <span>Retomar Atendimento (Em Execução)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAtualizarStatus(modalDetalheOS.id, 'CONCLUIDA')}
                        className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 flex items-center justify-center gap-1 transition-all"
                      >
                        <Check size={15} />
                        <span>Concluir Diretamente</span>
                      </button>
                    </div>
                  )}

                  {modalDetalheOS.status === 'EM_ANDAMENTO' && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => handleAtualizarStatus(modalDetalheOS.id, 'CONCLUIDA')}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <CheckCircle2 size={15} />
                        <span>Concluir Atendimento (Pronto para Cobrança)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAtualizarStatus(modalDetalheOS.id, 'AGUARDANDO_PECAS')}
                        className="py-2.5 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl border border-purple-200 flex items-center justify-center gap-1 transition-all"
                      >
                        <Package size={15} />
                        <span>Aguardar Peças</span>
                      </button>
                    </div>
                  )}

                  {modalDetalheOS.status === 'CONCLUIDA' && (
                    <div className="space-y-2">
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
                        <span>Cobrar e Faturar OS ({formatMoney(modalDetalheOS.valor_total)})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAtualizarStatus(modalDetalheOS.id, 'EM_ANDAMENTO')}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1"
                      >
                        <Clock size={14} />
                        <span>Reabrir Atendimento Técnico (Ajustes)</span>
                      </button>
                    </div>
                  )}

                  {/* Botão de Cancelamento com Justificativa */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleAbrirCancelarOS(modalDetalheOS)}
                      className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl border border-rose-200 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Ban size={14} />
                      <span>Cancelar Ordem de Serviço...</span>
                    </button>
                  </div>
                </div>
              )}

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

            <button
              onClick={() => setModalDetalheOS(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal Cancelamento de OS */}
      {modalCancelarOS && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => !cancelandoOS && setModalCancelarOS(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-rose-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div className="flex items-center gap-2 text-rose-600">
                <Ban size={20} />
                <h3 className="font-bold text-slate-900 text-base">Cancelar Ordem #{modalCancelarOS.id}</h3>
              </div>
              <button
                disabled={cancelandoOS}
                onClick={() => setModalCancelarOS(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <span>
                O cancelamento é irreversível e estorna automaticamente todas as peças consumidas de volta ao estoque da loja.
              </span>
            </div>

            <form onSubmit={handleConfirmarCancelamento} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Motivo / Justificativa do Cancelamento *
                </label>
                <textarea
                  required
                  rows={3}
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  placeholder="Informe detalhadamente por que este atendimento está sendo cancelado (ex: Cliente desistiu da peça, equipamento sem conserto viável, etc.)..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Mínimo de 5 caracteres. Este motivo constará nos relatórios gerenciais de auditoria.</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={cancelandoOS}
                  onClick={() => setModalCancelarOS(null)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={cancelandoOS || motivoCancelamento.trim().length < 5}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs shadow-md shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
                >
                  {cancelandoOS ? <RefreshCw size={14} className="animate-spin" /> : <Ban size={14} />}
                  <span>{cancelandoOS ? 'Cancelando...' : 'Confirmar Cancelamento'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Relatório de Cancelamentos de OS */}
      {modalRelatorioCancelamentosAberto && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalRelatorioCancelamentosAberto(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <Ban size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">Relatório de Cancelamentos de Ordens de Serviço</h3>
                  <p className="text-xs text-slate-500">Auditoria de justificativas, responsáveis e valores cancelados</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportarCSVRelatorioCancelamentos}
                  disabled={!relatorioCancelamentos?.ordens?.length}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-50"
                  title="Exportar para Excel (.csv com UTF-8 BOM)"
                >
                  <FileSpreadsheet size={15} />
                  <span>Exportar Excel</span>
                </button>
                <button
                  onClick={() => setModalRelatorioCancelamentosAberto(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Cards de Resumo */}
            {relatorioCancelamentos && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Canceladas</span>
                  <span className="text-lg font-black text-rose-700">{relatorioCancelamentos.total_ordens_canceladas} OS</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Mão de Obra Cancelada</span>
                  <span className="text-lg font-black text-slate-800">{formatMoney(relatorioCancelamentos.total_servicos_cancelados)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Peças Canceladas</span>
                  <span className="text-lg font-black text-slate-800">{formatMoney(relatorioCancelamentos.total_pecas_canceladas)}</span>
                </div>
                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
                  <span className="text-[10px] uppercase font-bold text-rose-500 block">Total Não Faturado</span>
                  <span className="text-lg font-black text-rose-800">{formatMoney(relatorioCancelamentos.total_valor_cancelado)}</span>
                </div>
              </div>
            )}

            {/* Listagem / Tabela de Cancelamentos */}
            <div className="flex-1 overflow-y-auto pr-1">
              {carregandoRelatorio ? (
                <div className="text-center py-12 text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Carregando dados de cancelamento...</span>
                </div>
              ) : !relatorioCancelamentos || relatorioCancelamentos.ordens.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                  Nenhuma ordem de serviço cancelada registrada no sistema.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">OS #</th>
                        <th className="py-2.5 px-3">Data Canc.</th>
                        <th className="py-2.5 px-3">Cliente / Veículo</th>
                        <th className="py-2.5 px-3">Motivo Informado</th>
                        <th className="py-2.5 px-3">Operador</th>
                        <th className="py-2.5 px-3 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {relatorioCancelamentos.ordens.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-rose-700">#{o.id}</td>
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                            {o.data_cancelamento ? new Date(o.data_cancelamento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-800 block truncate max-w-[150px]">{o.cliente_nome}</span>
                            <span className="text-[11px] text-slate-400 block truncate max-w-[150px]">{o.equipamento || o.titulo}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">
                            <span className="bg-rose-50 text-rose-900 border border-rose-100 px-2 py-1 rounded-lg block max-w-xs text-[11px] line-clamp-2">
                              {o.motivo_cancelamento || 'Motivo não informado'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {o.usuario_cancelamento_nome || 'Sistema'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-800 whitespace-nowrap">
                            {formatMoney(o.valor_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setModalRelatorioCancelamentosAberto(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                Fechar Relatório
              </button>
            </div>
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
                  { id: 'PIX', label: 'PIX', icon: QrCode },
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
              <div className="p-4 bg-sky-50/70 rounded-2xl border border-sky-200 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center mx-auto shadow-inner">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Recebimento via PIX (Balcão)</h4>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                    Solicite a transferência ao cliente utilizando a chave PIX ou o QR Code físico da loja.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Aguardando operador conferir o recebimento e dar baixa</span>
                </div>
              </div>
            )}

            {(formaPagamento === 'CARTAO_CREDITO' || formaPagamento === 'CARTAO_DEBITO') && (
              <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto shadow-inner">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Pagamento em Cartão ({formaPagamento === 'CARTAO_CREDITO' ? 'Crédito' : 'Débito'})
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                    Passe na maquininha física do estabelecimento (POS/TEF) e confirme a baixa.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Aguardando comprovante da maquininha</span>
                </div>
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
