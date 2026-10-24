import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Cliente } from '../types';
import { useEmpresa } from '../contexts/EmpresaContext';
import { 
  Users, Search, Plus, Phone, Mail, MapPin, DollarSign, 
  AlertCircle, Edit, Car, Sparkles, CheckCircle2 
} from 'lucide-react';

export const Clientes: React.FC = () => {
  const { perfilNegocio } = useEmpresa();
  const ehAutomotivo = perfilNegocio === 'lava_rapido' || perfilNegocio === 'mecanica';

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [modalCliente, setModalCliente] = useState<Partial<Cliente> | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);

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

  useEffect(() => {
    carregarClientes();
  }, [busca]);

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
    if (!modalCliente || !modalCliente.nome) return;

    try {
      if (modalCliente.id) {
        await apiService.atualizarCliente(modalCliente.id, modalCliente);
      } else {
        await apiService.criarCliente(modalCliente);
      }
      setModalCliente(null);
      carregarClientes();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao salvar cliente');
    }
  };

  const formatMoney = (val: number = 0) => {
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

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
              ? 'Cadastro de clientes, veículos (placa, modelo, cor) e histórico de serviços realizados.'
              : 'Cadastro de clientes, limite de crédito e acompanhamento financeiro.'}
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
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus size={16} />
          <span>{ehAutomotivo ? 'Cadastrar Cliente / Veículo' : 'Novo Cliente'}</span>
        </button>
      </div>

      {/* Busca */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="relative max-w-md">
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
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Lista de Clientes em Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clientes.length === 0 ? (
          <div className="col-span-full bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            Nenhum cliente encontrado.
          </div>
        ) : (
          clientes.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-tight">{c.nome}</h3>
                    {c.cpf_cnpj && <span className="text-[11px] text-slate-400">{c.cpf_cnpj}</span>}
                  </div>
                  <button
                    onClick={() => setModalCliente(c)}
                    className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-50"
                    title="Editar cliente"
                  >
                    <Edit size={15} />
                  </button>
                </div>

                {/* Veículo em Destaque */}
                {(c.placa_veiculo || c.modelo_veiculo) && (
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
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50 -mx-5 -mb-5 p-4 rounded-b-2xl">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Segmento</span>
                    <span className="font-semibold text-slate-700">Veículo / Cliente</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                      <CheckCircle2 size={12} /> Ativo
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50 -mx-5 -mb-5 p-4 rounded-b-2xl">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Limite de Crédito</span>
                    <span className="font-semibold text-slate-700">{formatMoney(c.limite_credito)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Saldo Devedor (Crediário)</span>
                    <span className={`font-bold ${c.saldo_devedor > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {formatMoney(c.saldo_devedor)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Criar / Editar Cliente */}
      {modalCliente && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 text-lg mb-1">
              {modalCliente.id ? 'Editar Cliente' : 'Novo Cliente'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Preencha os dados cadastrais, endereço e veículo vinculado.
            </p>

            <form onSubmit={handleSalvarCliente} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo / Razão Social *</label>
                <input
                  type="text"
                  required
                  value={modalCliente.nome || ''}
                  onChange={(e) => setModalCliente({ ...modalCliente, nome: e.target.value })}
                  placeholder="Ex: Carlos Silva"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CPF ou CNPJ</label>
                  <input
                    type="text"
                    value={modalCliente.cpf_cnpj || ''}
                    onChange={(e) => setModalCliente({ ...modalCliente, cpf_cnpj: e.target.value })}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={modalCliente.telefone || ''}
                    onChange={(e) => setModalCliente({ ...modalCliente, telefone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Informações do Veículo */}
              <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-100 space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold text-sky-900 text-xs">
                  <Car size={15} />
                  <span>Dados do Veículo (Lava Rápido / Mecânica)</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Placa</label>
                    <input
                      type="text"
                      value={modalCliente.placa_veiculo || ''}
                      onChange={(e) => setModalCliente({ ...modalCliente, placa_veiculo: e.target.value.toUpperCase() })}
                      placeholder="ABC-1234"
                      className="w-full px-2.5 py-1.5 uppercase font-mono font-bold border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Modelo / Marca</label>
                    <input
                      type="text"
                      value={modalCliente.modelo_veiculo || ''}
                      onChange={(e) => setModalCliente({ ...modalCliente, modelo_veiculo: e.target.value })}
                      placeholder="Ex: Fiat Argo 1.3"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cor</label>
                    <input
                      type="text"
                      value={modalCliente.cor_veiculo || ''}
                      onChange={(e) => setModalCliente({ ...modalCliente, cor_veiculo: e.target.value })}
                      placeholder="Ex: Prata"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={modalCliente.email || ''}
                  onChange={(e) => setModalCliente({ ...modalCliente, email: e.target.value })}
                  placeholder="cliente@email.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              {/* Endereço com CEP Automático */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1/3">
                    <label className="block font-semibold text-slate-700 mb-1">CEP</label>
                    <input
                      type="text"
                      value={modalCliente.cep || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setModalCliente({ ...modalCliente, cep: val });
                        if (val.replace(/\D/g, '').length === 8) {
                          handleBuscarCep(val);
                        }
                      }}
                      placeholder="00000-000"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                  <div className="w-2/3 pt-5">
                    <button
                      type="button"
                      disabled={buscandoCep}
                      onClick={() => modalCliente.cep && handleBuscarCep(modalCliente.cep)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <Sparkles size={14} className="text-sky-600" />
                      <span>{buscandoCep ? 'Buscando...' : 'Buscar Endereço pelo CEP'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Endereço Completo</label>
                  <input
                    type="text"
                    value={modalCliente.endereco || ''}
                    onChange={(e) => setModalCliente({ ...modalCliente, endereco: e.target.value })}
                    placeholder="Rua, número, complemento, bairro, cidade"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {!ehAutomotivo && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Limite de Crédito (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={modalCliente.limite_credito || 0}
                      onChange={(e) => setModalCliente({ ...modalCliente, limite_credito: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Saldo Devedor Atual (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={modalCliente.saldo_devedor || 0}
                      onChange={(e) => setModalCliente({ ...modalCliente, saldo_devedor: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-amber-700 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalCliente(null)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold text-sm shadow-xs"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

