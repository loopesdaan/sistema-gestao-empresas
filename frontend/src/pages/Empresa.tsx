import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Empresa as EmpresaType } from '../types';
import { useEmpresa, PALETAS_CORES } from '../contexts/EmpresaContext';
import { 
  Building, Phone, Mail, MapPin, Share2, Copy, 
  MessageCircle, ExternalLink, Edit, CheckCircle2, Save, X, Sparkles, RefreshCw, Palette, Camera, Upload
} from 'lucide-react';

interface EmpresaProps {
  isAdmin?: boolean;
  onOpenOnboarding?: () => void;
}

export const Empresa: React.FC<EmpresaProps> = ({ isAdmin = false, onOpenOnboarding }) => {
  const { corSelecionada, setCorSelecionada, setPerfilNegocio } = useEmpresa();
  const [empresa, setEmpresa] = useState<Partial<EmpresaType>>({});
  const [loading, setLoading] = useState(true);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [aplicandoPreset, setAplicandoPreset] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const res = await apiService.uploadImagem(file);
      const atualizado = await apiService.updateEmpresa({
        ...empresa,
        logo_url: res.url
      });
      setEmpresa(atualizado);
      alert('Logotipo atualizado com sucesso!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao enviar logotipo da empresa');
    } finally {
      setUploadingLogo(false);
    }
  };

  const carregarEmpresa = async () => {
    try {
      const dados = await apiService.getEmpresa();
      setEmpresa(dados);
      if (dados.cor_primaria) {
        setCorSelecionada(dados.cor_primaria);
      }
    } catch (err) {
      console.error('Erro ao carregar dados da empresa:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarEmpresa();
  }, []);

  const handleBuscarCep = async (cepInput: string) => {
    const clean = cepInput.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setBuscandoCep(true);
    try {
      const info = await apiService.buscarCep(clean);
      if (info) {
        setEmpresa((prev) => ({
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

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const atualizado = await apiService.updateEmpresa({
        ...empresa,
        cor_primaria: corSelecionada
      });
      setEmpresa(atualizado);
      if (atualizado.perfil_negocio) {
        setPerfilNegocio(atualizado.perfil_negocio);
      }
      setModoEdicao(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao atualizar dados da empresa');
    } finally {
      setSalvando(false);
    }
  };

  const handleAplicarPreset = async () => {
    if (!window.confirm(`Deseja carregar o catálogo de produtos e clientes modelo para o segmento "${empresa.perfil_negocio || 'personalizado'}"? Isso preencherá itens coerentes com seu ramo.`)) {
      return;
    }
    setAplicandoPreset(true);
    try {
      const res = await apiService.aplicarPresetSegmento(empresa.perfil_negocio || 'personalizado');
      alert(`Catálogo modelo aplicado com sucesso! ${res.produtos_cadastrados || 0} produtos e serviços e ${res.clientes_cadastrados || 0} clientes adicionados.`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao carregar dados modelo.');
    } finally {
      setAplicandoPreset(false);
    }
  };

  const getTextoCompartilhamento = () => {
    return `*${empresa.nome_fantasia || empresa.razao_social}*
CNPJ: ${empresa.cnpj || 'Não informado'}
Telefone: ${empresa.telefone || 'Não informado'}
E-mail: ${empresa.email || 'Não informado'}
Endereço: ${empresa.endereco || 'Não informado'}${empresa.cep ? ' - CEP: ' + empresa.cep : ''}`;
  };

  const handleCopiarDados = () => {
    navigator.clipboard.writeText(getTextoCompartilhamento());
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const handleCompartilharWhatsApp = () => {
    const texto = encodeURIComponent(getTextoCompartilhamento());
    window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank');
  };

  const handleCompartilharEmail = () => {
    const assunto = encodeURIComponent(`Dados de Contato - ${empresa.nome_fantasia || empresa.razao_social}`);
    const corpo = encodeURIComponent(getTextoCompartilhamento());
    window.open(`mailto:?subject=${assunto}&body=${corpo}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Card Principal - Visualização & Compartilhamento */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Banner Superior */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              {empresa.logo_url ? (
                <img
                  src={empresa.logo_url.startsWith('http') ? empresa.logo_url : `http://localhost:8000${empresa.logo_url}`}
                  alt="Logotipo da Empresa"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-600 bg-white shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 font-bold text-2xl shadow-inner">
                  <Building size={30} />
                </div>
              )}
              {isAdmin && (
                <label className="absolute inset-0 bg-black/70 rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-white text-[10px] font-bold p-1 text-center">
                  <Camera size={18} className="mb-0.5" />
                  <span>{uploadingLogo ? 'Enviando...' : 'Trocar Logo'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleUploadLogo}
                    disabled={uploadingLogo}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                {empresa.nome_fantasia || empresa.razao_social || 'Minha Empresa'}
              </h2>
              {empresa.nome_fantasia && (
                <p className="text-xs text-slate-400">{empresa.razao_social}</p>
              )}
              {empresa.cnpj && (
                <span className="inline-block mt-1 text-[11px] font-mono bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded">
                  CNPJ: {empresa.cnpj}
                </span>
              )}
            </div>
          </div>

          {isAdmin && !modoEdicao && (
            <div className="flex flex-wrap items-center gap-2">
              {onOpenOnboarding && (
                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  className="flex items-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-sky-600/20 transition-all border border-sky-400/30"
                >
                  <Sparkles size={14} />
                  <span>Assistente de Configuração</span>
                </button>
              )}
              <button
                onClick={() => setModoEdicao(true)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                <Edit size={14} />
                <span>Editar Informações</span>
              </button>
            </div>
          )}
        </div>

        {/* Informações de Contato e Localização */}
        {!modoEdicao ? (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
                  <Phone size={18} />
                </div>
                <div className="overflow-hidden">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Telefone</span>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{empresa.telefone || 'Não informado'}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                  <Mail size={18} />
                </div>
                <div className="overflow-hidden">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">E-mail</span>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{empresa.email || 'Não informado'}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                  <MapPin size={18} />
                </div>
                <div className="overflow-hidden">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Localização & CEP
                  </span>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5 line-clamp-2">
                    {empresa.endereco || 'Não informado'}
                  </p>
                  {empresa.cep && (
                    <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                      CEP: {empresa.cep}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Configuração Visual e Catálogo de Demonstração */}
            {isAdmin && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Palette size={15} className="text-sky-600" />
                      <span>Paleta de Cores Predominante das Telas</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Mude instantaneamente as cores de destaque de botões, barras e ícones.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-sky-700 bg-sky-100 px-2.5 py-0.5 rounded-full">
                    {PALETAS_CORES[corSelecionada]?.label || 'Safira'}
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
                  {Object.values(PALETAS_CORES).map((paleta) => {
                    const ativa = corSelecionada === paleta.id;
                    return (
                      <button
                        key={paleta.id}
                        type="button"
                        onClick={async () => {
                          setCorSelecionada(paleta.id);
                          try {
                            await apiService.updateEmpresa({ ...empresa, cor_primaria: paleta.id });
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                          ativa
                            ? 'border-slate-900 bg-white shadow-xs ring-2 ring-slate-900/10 scale-105'
                            : 'border-slate-200 bg-white/70 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-full border border-slate-300 mb-1"
                          style={{ backgroundColor: paleta.previewHex }}
                        />
                        <span className="text-[9px] font-bold text-slate-700 leading-tight truncate w-full">
                          {paleta.label.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Catálogo Modelo ({empresa.perfil_negocio ? empresa.perfil_negocio.replace('_', ' ').toUpperCase() : 'GERAL'})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Deseja repor itens e clientes modelo adequados ao perfil do negócio?
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={aplicandoPreset}
                    onClick={handleAplicarPreset}
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw size={13} className={aplicandoPreset ? 'animate-spin' : ''} />
                    <span>{aplicandoPreset ? 'Carregando dados...' : 'Carregar Catálogo Modelo'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Ações Rápidas de Compartilhamento com Clientes */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Share2 size={14} className="text-sky-600" />
                Compartilhar Dados da Empresa com Clientes
              </h4>

              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={handleCompartilharWhatsApp}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  <MessageCircle size={16} />
                  <span>Enviar pelo WhatsApp</span>
                </button>

                <button
                  onClick={handleCopiarDados}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Copy size={15} />
                  <span>{copiado ? 'Copiado para Área de Transferência!' : 'Copiar Texto'}</span>
                </button>

                <button
                  onClick={handleCompartilharEmail}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Mail size={15} />
                  <span>Enviar por E-mail</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Formulário de Edição para o Admin */
          <form onSubmit={handleSalvar} className="p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Editar Cadastro da Empresa</h3>
              <button
                type="button"
                onClick={() => setModoEdicao(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Razão Social *</label>
              <input
                type="text"
                required
                value={empresa.razao_social || ''}
                onChange={(e) => setEmpresa({ ...empresa, razao_social: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Fantasia</label>
                <input
                  type="text"
                  value={empresa.nome_fantasia || ''}
                  onChange={(e) => setEmpresa({ ...empresa, nome_fantasia: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  value={empresa.cnpj || ''}
                  onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Telefone / WhatsApp Comercial</label>
                <input
                  type="text"
                  value={empresa.telefone || ''}
                  onChange={(e) => setEmpresa({ ...empresa, telefone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail Comercial</label>
                <input
                  type="email"
                  value={empresa.email || ''}
                  onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">CEP</label>
                  <button
                    type="button"
                    disabled={buscandoCep}
                    onClick={() => empresa.cep && handleBuscarCep(empresa.cep)}
                    className="text-[10px] text-sky-600 hover:text-sky-700 font-bold disabled:opacity-50"
                  >
                    {buscandoCep ? 'Buscando...' : 'Buscar CEP'}
                  </button>
                </div>
                <input
                  type="text"
                  value={empresa.cep || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmpresa({ ...empresa, cep: val });
                    if (val.replace(/\D/g, '').length === 8) {
                      handleBuscarCep(val);
                    }
                  }}
                  placeholder="00000-000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Endereço Completo</label>
                <input
                  type="text"
                  value={empresa.endereco || ''}
                  onChange={(e) => setEmpresa({ ...empresa, endereco: e.target.value })}
                  placeholder="Rua, número, complemento, bairro, cidade - UF"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModoEdicao(false)}
                className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold text-sm shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={16} />
                <span>{salvando ? 'Salvando...' : 'Salvar Informações'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
