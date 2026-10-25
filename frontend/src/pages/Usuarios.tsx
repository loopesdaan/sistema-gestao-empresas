import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Usuario, PerfilUsuario } from '../types';
import { UserCheck, Shield, Plus, Edit, Lock, CheckCircle2, AlertCircle, Camera, Upload, X, Trash2 } from 'lucide-react';

export const Usuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [modalUsuario, setModalUsuario] = useState<{
    id?: number;
    nome: string;
    email: string;
    password?: string;
    perfil: PerfilUsuario;
    ativo: boolean;
    foto_url?: string;
  } | null>(null);

  const carregarUsuarios = async () => {
    setLoading(true);
    try {
      const data = await apiService.listarUsuarios();
      setUsuarios(data);
    } catch (err) {
      console.error('Erro ao listar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirUsuario = async (id: number, nome: string) => {
    if (!window.confirm(`Deseja realmente excluir o colaborador "${nome}"?`)) return;

    try {
      const res = await apiService.excluirUsuario(id);
      alert(res.mensagem || 'Usuário excluído com sucesso.');
      if (modalUsuario?.id === id) {
        setModalUsuario(null);
      }
      carregarUsuarios();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao excluir usuário.');
    }
  };

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !modalUsuario) return;
    setUploadingFoto(true);
    try {
      const res = await apiService.uploadImagem(file);
      setModalUsuario(prev => prev ? ({ ...prev, foto_url: res.url }) : null);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao enviar foto do funcionário');
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalUsuario) return;

    try {
      if (modalUsuario.id) {
        await apiService.atualizarUsuario(modalUsuario.id, modalUsuario);
      } else {
        if (!modalUsuario.password) {
          alert('Informe uma senha inicial para o novo usuário.');
          return;
        }
        await apiService.criarUsuario(modalUsuario);
      }
      setModalUsuario(null);
      carregarUsuarios();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao salvar usuário');
    }
  };

  const perfilLabels: Record<PerfilUsuario, { label: string; badge: string }> = {
    ADMIN: { label: 'Gerente Geral (Acesso Total)', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
    OPERADOR_CAIXA: { label: 'Operador de Caixa (PDV & OS)', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    VENDEDOR: { label: 'Vendedor Comercial', badge: 'bg-sky-100 text-sky-800 border-sky-200' },
    TECNICO: { label: 'Técnico de Serviços', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
    ESTOQUISTA: { label: 'Controlador de Estoque', badge: 'bg-amber-100 text-amber-800 border-amber-200' }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">Equipe & Permissões de Acesso</h2>
            <span className="bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-purple-200">
              Apenas Administrador
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie operadores de caixa, administradores e controle quem tem acesso ao sistema.
          </p>
        </div>

        <button
          onClick={() => setModalUsuario({
            nome: '',
            email: '',
            password: '',
            perfil: 'OPERADOR_CAIXA',
            ativo: true
          })}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus size={16} />
          <span>Novo Membro da Equipe</span>
        </button>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Nome do Funcionário</th>
                <th className="py-3.5 px-4">E-mail de Login</th>
                <th className="py-3.5 px-4">Perfil / Função</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {usuarios.map((u) => {
                const pInfo = perfilLabels[u.perfil] || { label: u.perfil, badge: 'bg-slate-100 text-slate-700' };
                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-3">
                      {u.foto_url ? (
                        <img
                          src={u.foto_url.startsWith('http') ? u.foto_url : `http://localhost:8000${u.foto_url}`}
                          alt={u.nome}
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                          {u.nome.charAt(0)}
                        </div>
                      )}
                      <span>{u.nome}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {u.email}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${pInfo.badge}`}>
                        {pInfo.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        u.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setModalUsuario({
                            id: u.id,
                            nome: u.nome,
                            email: u.email,
                            password: '',
                            perfil: u.perfil,
                            ativo: u.ativo
                          })}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <Edit size={13} />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => handleExcluirUsuario(u.id, u.nome)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors"
                          title={`Excluir ${u.nome}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar / Editar Usuário com Fechamento ao Clicar Fora */}
      {modalUsuario && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalUsuario(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-slate-800 text-base leading-tight">
                {modalUsuario.id ? 'Editar Acesso do Usuário' : 'Cadastrar Novo Usuário'}
              </h3>
              <button
                type="button"
                onClick={() => setModalUsuario(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Defina as credenciais e o nível de acesso do colaborador.
            </p>

            <form onSubmit={handleSalvar} className="space-y-3.5 text-xs">
              {/* Foto do Funcionário */}
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="relative group shrink-0">
                  {modalUsuario.foto_url ? (
                    <img
                      src={modalUsuario.foto_url.startsWith('http') ? modalUsuario.foto_url : `http://localhost:8000${modalUsuario.foto_url}`}
                      alt="Foto"
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                      className="w-14 h-14 rounded-full object-cover border border-slate-300 shadow-2xs"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-lg">
                      {modalUsuario.nome ? modalUsuario.nome.charAt(0) : <Camera size={22} />}
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-white text-[9px] font-bold">
                    <Camera size={14} />
                    <span>Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadFoto}
                      disabled={uploadingFoto}
                      className="hidden"
                    />
                  </label>
                </div>
                <div>
                  <span className="font-bold text-slate-800 text-xs block">Foto de Identificação</span>
                  <p className="text-[11px] text-slate-400">
                    {uploadingFoto ? 'Enviando imagem...' : 'Opcional. Passe o mouse sobre a imagem para trocar.'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={modalUsuario.nome}
                  onChange={(e) => setModalUsuario({ ...modalUsuario, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail de Acesso *</label>
                <input
                  type="email"
                  required
                  value={modalUsuario.email}
                  onChange={(e) => setModalUsuario({ ...modalUsuario, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {modalUsuario.id ? 'Nova Senha (deixe em branco para manter a atual)' : 'Senha de Acesso *'}
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={modalUsuario.password || ''}
                  onChange={(e) => setModalUsuario({ ...modalUsuario, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Perfil de Acesso</label>
                <select
                  value={modalUsuario.perfil}
                  onChange={(e) => setModalUsuario({ ...modalUsuario, perfil: e.target.value as PerfilUsuario })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium bg-white"
                >
                  <option value="ADMIN">Gerente Geral (Acesso Total, Relatórios e Equipe)</option>
                  <option value="OPERADOR_CAIXA">Operador de Caixa (Vendas no PDV, Controle de Caixa & OS)</option>
                  <option value="ESTOQUISTA">Controlador de Estoque (Inventário, Ajustes e Balanço Físico)</option>
                  <option value="VENDEDOR">Vendedor Comercial (Balcão e Clientes)</option>
                  <option value="TECNICO">Técnico de Serviços (Ordens de Serviço e Peças)</option>
                </select>
              </div>

              {modalUsuario.id && (
                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="user_ativo"
                    checked={modalUsuario.ativo}
                    onChange={(e) => setModalUsuario({ ...modalUsuario, ativo: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                  <label htmlFor="user_ativo" className="text-xs font-semibold text-slate-700">
                    Usuário Ativo (desmarque para bloquear o acesso)
                  </label>
                </div>
              )}

              <div className="flex items-center gap-2 pt-3">
                {modalUsuario.id && (
                  <button
                    type="button"
                    onClick={() => handleExcluirUsuario(modalUsuario.id!, modalUsuario.nome)}
                    className="py-2 px-3 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5"
                    title="Excluir este colaborador"
                  >
                    <Trash2 size={14} />
                    <span>Excluir</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalUsuario(null)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold text-sm shadow-xs transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

