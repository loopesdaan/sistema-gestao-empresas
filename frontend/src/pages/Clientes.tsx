import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/api';
import { Cliente } from '../types';
import { useEmpresa } from '../contexts/EmpresaContext';
import { useToast } from '../contexts/ToastContext';
import { 
  Users, Search, Plus, Phone, Mail, MapPin, DollarSign, 
  AlertCircle, Edit, Car, Sparkles, CheckCircle2,
  TrendingDown, CreditCard, X, Trash2, Banknote, Wallet, Check
} from 'lucide-react';
import { formatarCpfCnpj, formatarTelefone } from '../utils/formatters';

interface ModalQuitacaoState {
  cliente: Cliente;
  valor: number;
  formaPagamento: 'DINHEIRO' | 'PIX' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO';
  lancarCaixa: boolean;
}

export const Clientes: React.FC<{ isAdmin?: boolean }> = ({ isAdmin }) => {
  const { perfilNegocio, temaAtual } = useEmpresa();
  const { toast, confirmar } = useToast();
  const usuarioSalvo = localStorage.getItem('gestao_user') || sessionStorage.getItem('gestao_user');
  const usuarioLogado = usuarioSalvo ? JSON.parse(usuarioSalvo) : null;
  const ehAdmin = isAdmin ?? (usuarioLogado?.perfil === 'ADMIN');
  const ehAutomotivo = perfilNegocio === 'lava_rapido' || perfilNegocio === 'mecanica';

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'COM_DEBITO' | 'SEM_DEBITO'>('TODOS');
  const [modalCliente, setModalCliente] = useState<Partial<Cliente> | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Modal intuitivo de quitação/baixa de débito
  const [modalQuitacao, setModalQuitacao] = useState<ModalQuitacaoState | null>(null);
  const [salvandoQuitacao, setSalvandoQuitacao] = useState(false);
  const [feedbackQuitacao, setFeedbackQuitacao] = useState<string | null>(null);

  const carregarClientes = async () => {
    setLoading(true);
    try {
      const data = await apiService.listarClientes(busca);
      setClientes(data);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirCliente = (id: number, nome: string) => {
    confirmar({
      titulo: 'Excluir Cliente',
      mensagem: `Deseja realmente excluir o cliente "${nome}"? Esta operação é irreversível.`,
      tipo: 'perigo',
      textoConfirmar: 'Sim, Excluir',
      textoCancelar: 'Cancelar',
      onConfirmar: async () => {
        try {
          const res = await apiService.excluirCliente(id);
          toast.sucesso(res.mensagem || 'Cliente excluído com sucesso.');
          if (modalCliente?.id === id) {
            setModalCliente(null);
          }
          carregarClientes();
        } catch (err: any) {
          toast.erro(err.response?.data?.detail || 'Erro ao excluir cliente.');
        }
      }
    });
  };

  useEffect(() => {
    carregarClientes();
  }, [busca]);

  // Métricas do Dashboard de Clientes
  const metricas = useMemo(() => {
    const total = clientes.length;
    const devedores = clientes.filter(c => Number(c.saldo_devedor || 0) > 0);
    const totalDevedor = devedores.reduce((acc, c) => acc + Number(c.saldo_devedor || 0), 0);
    const totalLimite = clientes.reduce((acc, c) => acc + Number(c.limite_credito || 0), 0);

    return {
      total,
      qtdDevedores: devedores.length,
      totalDevedor,
      totalLimite,
    };
  }, [clientes]);

  const handleBuscarCep = async (cepInput: string) => {
    const clean = cepInput.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setBuscandoCep(true);
    try {
      const info = await apiService.buscarCep(clean);
      if (info) {
        setModalCliente((prev) => ({
          ...prev,
          cep: info.cep,
          endereco: info.enderecoCompleto
        }));
      }
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleSalvarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCliente?.nome) return;

    try {
      const payload = {
        ...modalCliente,
        limite_credito: Number(modalCliente.limite_credito || 0)
      };
      if (modalCliente.id) {
        await apiService.atualizarCliente(modalCliente.id, payload);
        toast.sucesso('Dados do cliente atualizados com sucesso!');
      } else {
        await apiService.criarCliente(payload);
        toast.sucesso('Cliente cadastrado com sucesso!');
      }
      setModalCliente(null);
      carregarClientes();
    } catch (err: any) {
      toast.erro(err.response?.data?.detail || 'Erro ao salvar cliente.');
    }
  };

  const handleConfirmarQuitacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalQuitacao) return;

    const valorPago = Number(modalQuitacao.valor);
    if (isNaN(valorPago) || valorPago <= 0) {
      toast.aviso('Informe um valor válido para quitação.');
      return;
    }

    setSalvandoQuitacao(true);
    try {
      // 1. Quitação transacional atômica no backend (abate saldo e lança no caixa)
      const res = await apiService.quitarDebitoCliente(modalQuitacao.cliente.id, {
        valor: valorPago,
        forma_pagamento: modalQuitacao.formaPagamento,
        lancar_caixa: modalQuitacao.lancarCaixa
      });

      setFeedbackQuitacao(res.mensagem || `Recebimento de ${formatMoney(valorPago)} de ${modalQuitacao.cliente.nome} registrado com sucesso!`);
      toast.sucesso(res.mensagem || 'Recebimento de débito concluído com sucesso!');
      setTimeout(() => {
        setFeedbackQuitacao(null);
        setModalQuitacao(null);
        carregarClientes();
      }, 1200);
    } catch (err: any) {
      let msg = 'Erro ao registrar quitação do débito.';
      if (err.response?.data?.detail) {
        const d = err.response.data.detail;
        msg = typeof d === 'string' ? d : JSON.stringify(d);
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (err.message) {
        msg = err.message;
      }
      toast.erro(msg);
    } finally {
      setSalvandoQuitacao(false);
    }
  };

  const formatMoney = (val: number = 0) => {
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      if (filtroStatus === 'COM_DEBITO') return Number(c.saldo_devedor || 0) > 0;
      if (filtroStatus === 'SEM_DEBITO') return Number(c.saldo_devedor || 0) === 0;
      return true;
    });
  }, [clientes, filtroStatus]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {ehAutomotivo ? <Car className="text-sky-600" size={22} /> : <Users className="text-sky-600" size={22} />}
            <h2 className="text-xl font-bold text-slate-800">
              {ehAutomotivo ? 'Clientes & Veículos / Frotas' : 'Clientes & Controle de Crédito'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {ehAutomotivo
              ? 'Cadastro de clientes, veículos (placa, modelo, cor) e histórico de atendimentos.'
              : 'Gestão da carteira de clientes, limite de crediário/fiado e acompanhamento de débitos em aberto.'}
          </p>
        </div>

        <button
          onClick={() => setModalCliente({
            nome: '',
            cpf_cnpj: '',
            telefone: '',
            email: '',
            cep: '',
            endereco: '',
            placa_veiculo: '',
            modelo_veiculo: '',
            cor_veiculo: '',
            limite_credito: 500,
            saldo_devedor: 0,
            ativo: true
          })}
          className={`flex items-center gap-2 bg-gradient-to-r ${temaAtual.bgGradiente} hover:opacity-95 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all`}
        >
          <Plus size={16} />
          <span>{ehAutomotivo ? 'Cadastrar Cliente / Veículo' : 'Novo Cliente'}</span>
        </button>
      </div>

      {/* Dashboard Analítico de Clientes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase block tracking-wider">
              Total de Clientes
            </span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">
              {metricas.total}
            </span>
            <span className="text-[10px] text-slate-400">Cadastrados no sistema</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase block tracking-wider">
              Fiado / Em Aberto
            </span>
            <span className={`text-2xl font-black mt-1 block ${metricas.totalDevedor > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {formatMoney(metricas.totalDevedor)}
            </span>
            <span className="text-[10px] text-slate-400">
              {metricas.qtdDevedores} cliente(s) com débito
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <TrendingDown size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase block tracking-wider">
              Limite Concedido
            </span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">
              {formatMoney(metricas.totalLimite)}
            </span>
            <span className="text-[10px] text-slate-400">Teto total autorizado</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <CreditCard size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase block tracking-wider">
              Em Dia / Sem Débito
            </span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">
              {metricas.total - metricas.qtdDevedores}
            </span>
            <span className="text-[10px] text-slate-400">Clientes 100% regulares</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={
              ehAutomotivo
                ? 'Buscar por nome, placa do veículo, modelo ou CPF...'
                : 'Buscar cliente por nome, CPF/CNPJ ou telefone...'
            }
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
          />
        </div>

        {/* Filtro Rápido de Status */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFiltroStatus('TODOS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filtroStatus === 'TODOS'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            Todos ({metricas.total})
          </button>
          <button
            type="button"
            onClick={() => setFiltroStatus('COM_DEBITO')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filtroStatus === 'COM_DEBITO'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
            }`}
          >
            Com Débito ({metricas.qtdDevedores})
          </button>
          <button
            type="button"
            onClick={() => setFiltroStatus('SEM_DEBITO')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filtroStatus === 'SEM_DEBITO'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}
          >
            Em Dia ({metricas.total - metricas.qtdDevedores})
          </button>
        </div>
      </div>

      {/* Lista de Clientes em Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clientesFiltrados.length === 0 ? (
          <div className="col-span-full bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            Nenhum cliente encontrado com os filtros selecionados.
          </div>
        ) : (
          clientesFiltrados.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-tight">{c.nome}</h3>
                    {c.cpf_cnpj && <span className="text-[11px] text-slate-400 font-mono">{c.cpf_cnpj}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setModalCliente(c)}
                      className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-50 transition-colors"
                      title="Editar cliente"
                    >
                      <Edit size={15} />
                    </button>
                    <button
                      onClick={() => handleExcluirCliente(c.id, c.nome)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Excluir cliente"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Veículo em Destaque (Apenas para Lava Rápido / Mecânica) */}
                {ehAutomotivo && (c.placa_veiculo || c.modelo_veiculo) && (
                  <div className="mt-2 p-2.5 bg-sky-50/80 border border-sky-100 rounded-xl flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      <Car size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-white px-2 py-0.5 rounded border border-sky-200 text-sky-900">
                          {c.placa_veiculo || 'SEM PLACA'}
                        </span>
                        {c.cor_veiculo && (
                          <span className="text-[10px] text-slate-500 capitalize">
                            • {c.cor_veiculo}
                          </span>
                        )}
                      </div>
                      {c.modelo_veiculo && (
                        <p className="text-[11px] font-semibold text-slate-700 truncate mt-0.5">
                          {c.modelo_veiculo}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                  {c.telefone && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-400" />
                      <span>{c.telefone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-slate-400" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.endereco && (
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-slate-400" />
                      <span className="truncate">{c.endereco}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rodapé do Card */}
              {ehAutomotivo ? (
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2.5 bg-slate-50 -mx-5 -mb-5 p-4 rounded-b-2xl">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Segmento</span>
                      <span className="font-semibold text-slate-700">Veículo / Cliente</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Saldo Devedor</span>
                      <span className={`font-bold ${Number(c.saldo_devedor) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {formatMoney(c.saldo_devedor)}
                      </span>
                    </div>
                  </div>

                  {Number(c.saldo_devedor) > 0 && (
                    <button
                      onClick={() => setModalQuitacao({
                        cliente: c,
                        valor: Number(c.saldo_devedor),
                        formaPagamento: 'DINHEIRO',
                        lancarCaixa: true
                      })}
                      className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Banknote size={15} />
                      <span>Receber Débito ({formatMoney(c.saldo_devedor)})</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2.5 bg-slate-50 -mx-5 -mb-5 p-4 rounded-b-2xl">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Limite de Crédito</span>
                      <span className="font-semibold text-slate-700">{formatMoney(c.limite_credito)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Saldo Devedor (Fiado)</span>
                      <span className={`font-bold ${Number(c.saldo_devedor) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {formatMoney(c.saldo_devedor)}
                      </span>
                    </div>
                  </div>

                  {Number(c.saldo_devedor) > 0 && (
                    <button
                      onClick={() => setModalQuitacao({
                        cliente: c,
                        valor: Number(c.saldo_devedor),
                        formaPagamento: 'DINHEIRO',
                        lancarCaixa: true
                      })}
                      className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Banknote size={15} />
                      <span>Receber Débito ({formatMoney(c.saldo_devedor)})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Criar / Editar Cliente com Fechamento ao Clicar Fora */}
      {modalCliente && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalCliente(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl bg-gradient-to-r ${temaAtual.bgGradiente} text-white shadow-xs`}>
                  {ehAutomotivo ? <Car size={18} /> : <Users size={18} />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base leading-tight">
                    {modalCliente.id ? 'Editar Cadastro de Cliente' : 'Novo Cadastro de Cliente'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {ehAutomotivo ? 'Dados do cliente e do veículo' : 'Dados cadastrais, endereço e limite de crediário'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalCliente(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarCliente} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo / Razão Social *</label>
                <input
                  type="text"
                  required
                  value={modalCliente.nome || ''}
                  onChange={(e) => setModalCliente({ ...modalCliente, nome: e.target.value })}
                  placeholder="Ex: Carlos Silva ou Distribuidora ABC"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CPF ou CNPJ</label>
                  <input
                    type="text"
                    value={modalCliente.cpf_cnpj || ''}
                    onChange={(e) => setModalCliente({ ...modalCliente, cpf_cnpj: formatarCpfCnpj(e.target.value) })}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={modalCliente.telefone || ''}
                    onChange={(e) => setModalCliente({ ...modalCliente, telefone: formatarTelefone(e.target.value) })}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={modalCliente.email || ''}
                  onChange={(e) => setModalCliente({ ...modalCliente, email: e.target.value })}
                  placeholder="cliente@email.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              {/* Endereço com Busca Automática por CEP */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700 text-[11px]">CEP</label>
                    <button
                      type="button"
                      disabled={buscandoCep}
                      onClick={() => modalCliente.cep && handleBuscarCep(modalCliente.cep)}
                      className="text-[10px] text-sky-600 font-bold hover:underline"
                    >
                      {buscandoCep ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={modalCliente.cep || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setModalCliente({ ...modalCliente, cep: v });
                      if (v.replace(/\D/g, '').length === 8) {
                        handleBuscarCep(v);
                      }
                    }}
                    placeholder="00000-000"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block font-semibold text-slate-700 text-[11px] mb-1">Endereço Completo</label>
                  <input
                    type="text"
                    value={modalCliente.endereco || ''}
                    onChange={(e) => setModalCliente({ ...modalCliente, endereco: e.target.value })}
                    placeholder="Rua, Número, Bairro, Cidade"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Informações do Veículo: Exibido APENAS para segmentos automotivos (Lava Rápido / Mecânica) */}
              {ehAutomotivo && (
                <div className="p-3.5 bg-sky-50/60 rounded-2xl border border-sky-100 space-y-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-sky-900 text-xs">
                    <Car size={15} />
                    <span>Dados do Veículo (Mecânica / Lava Rápido)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Placa</label>
                      <input
                        type="text"
                        value={modalCliente.placa_veiculo || ''}
                        onChange={(e) => setModalCliente({ ...modalCliente, placa_veiculo: e.target.value.toUpperCase() })}
                        placeholder="ABC-1234"
                        className="w-full px-2.5 py-1.5 uppercase font-mono font-bold border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Modelo / Marca</label>
                      <input
                        type="text"
                        value={modalCliente.modelo_veiculo || ''}
                        onChange={(e) => setModalCliente({ ...modalCliente, modelo_veiculo: e.target.value })}
                        placeholder="Ex: Fiat Argo 1.3"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cor</label>
                      <input
                        type="text"
                        value={modalCliente.cor_veiculo || ''}
                        onChange={(e) => setModalCliente({ ...modalCliente, cor_veiculo: e.target.value })}
                        placeholder="Ex: Prata"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Informações Financeiras: Limite de Crédito e Saldo Devedor */}
              {!ehAutomotivo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700">Limite de Crédito (R$)</label>
                      {!ehAdmin && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-bold border border-amber-200">
                          🔒 Apenas Gerente/ADM
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      disabled={!ehAdmin}
                      value={modalCliente.limite_credito === undefined || modalCliente.limite_credito === null ? '' : modalCliente.limite_credito}
                      onChange={(e) => {
                        const val = e.target.value;
                        setModalCliente({
                          ...modalCliente,
                          limite_credito: val === '' ? ('' as any) : parseFloat(val)
                        });
                      }}
                      className={`w-full px-3 py-2 border rounded-xl text-sm font-semibold focus:outline-none ${!ehAdmin ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'border-slate-300 focus:ring-1 focus:ring-sky-500'}`}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Saldo Devedor Atual (Fiado)</label>
                    <input
                      type="number"
                      step="0.01"
                      disabled
                      value={modalCliente.saldo_devedor || 0}
                      onChange={(e) => setModalCliente({ ...modalCliente, saldo_devedor: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-sm font-bold text-amber-700 cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-3">
                {modalCliente.id && (
                  <button
                    type="button"
                    onClick={() => handleExcluirCliente(modalCliente.id!, modalCliente.nome || '')}
                    className="py-2.5 px-3 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5"
                    title="Excluir este cliente"
                  >
                    <Trash2 size={14} />
                    <span>Excluir</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalCliente(null)}
                  className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 bg-gradient-to-r ${temaAtual.bgGradiente} text-white rounded-xl font-bold text-xs shadow-xs transition-all`}
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Intuitivo de Quitação de Débito / Fiado */}
      {modalQuitacao && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => !salvandoQuitacao && setModalQuitacao(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs">
                  <Banknote size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base leading-tight">
                    Receber Débito de Cliente
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate max-w-[240px]">
                    {modalQuitacao.cliente.nome}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={salvandoQuitacao}
                onClick={() => setModalQuitacao(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Feedback Sucesso */}
            {feedbackQuitacao && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{feedbackQuitacao}</span>
              </div>
            )}

            {/* Resumo da Dívida */}
            <div className="bg-gradient-to-br from-slate-50 to-amber-50/40 p-3.5 rounded-2xl border border-amber-200/60">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500 font-semibold">Saldo Devedor Atual:</span>
                <span className="text-amber-700 font-black text-sm">
                  {formatMoney(modalQuitacao.cliente.saldo_devedor)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-amber-100">
                <span className="text-slate-500 font-semibold">Saldo Restante Após Pagamento:</span>
                <span className="text-slate-800 font-bold">
                  {formatMoney(Math.max(0, Number(modalQuitacao.cliente.saldo_devedor || 0) - (Number(modalQuitacao.valor) || 0)))}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmarQuitacao} className="space-y-3.5 text-xs">
              {/* Valor a Receber */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Valor a Receber (R$) *</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setModalQuitacao({
                        ...modalQuitacao,
                        valor: Number(modalQuitacao.cliente.saldo_devedor || 0)
                      })}
                      className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-[10px] font-bold transition-colors"
                    >
                      Quitar Tudo
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalQuitacao({
                        ...modalQuitacao,
                        valor: Math.round((Number(modalQuitacao.cliente.saldo_devedor || 0) / 2) * 100) / 100
                      })}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors"
                    >
                      50%
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(modalQuitacao.cliente.saldo_devedor || 0)}
                  required
                  value={modalQuitacao.valor || ''}
                  onChange={(e) => setModalQuitacao({
                    ...modalQuitacao,
                    valor: parseFloat(e.target.value) || 0
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-black text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Forma de Pagamento</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
                    { id: 'PIX', label: 'PIX', icon: Sparkles },
                    { id: 'CARTAO_DEBITO', label: 'Cartão Débito', icon: CreditCard },
                    { id: 'CARTAO_CREDITO', label: 'Cartão Crédito', icon: CreditCard }
                  ].map((fp) => {
                    const Icon = fp.icon;
                    const ativo = modalQuitacao.formaPagamento === fp.id;
                    return (
                      <button
                        type="button"
                        key={fp.id}
                        onClick={() => setModalQuitacao({
                          ...modalQuitacao,
                          formaPagamento: fp.id as any
                        })}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          ativo
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700 font-medium'
                        }`}
                      >
                        <Icon size={15} className={ativo ? 'text-emerald-600' : 'text-slate-400'} />
                        <span className="text-xs">{fp.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lançamento Automático no Caixa */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100/60 transition-colors">
                <input
                  type="checkbox"
                  checked={modalQuitacao.lancarCaixa}
                  onChange={(e) => setModalQuitacao({
                    ...modalQuitacao,
                    lancarCaixa: e.target.checked
                  })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <div className="text-left">
                  <span className="font-bold text-slate-800 block text-xs">
                    Lançar entrada no Caixa Aberto
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Registra automaticamente como Suprimento/Recebimento no caixa ativo.
                  </span>
                </div>
              </label>

              {/* Ações */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={salvandoQuitacao}
                  onClick={() => setModalQuitacao(null)}
                  className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoQuitacao || Number(modalQuitacao.valor) <= 0}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {salvandoQuitacao ? (
                    <span>Registrando...</span>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>Confirmar Recebimento</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
