import React, { useState, useEffect } from 'react';
import { apiService, resolveImageUrl } from '../services/api';
import { Usuario } from '../types';
import { useToast } from '../contexts/ToastContext';
import { User, Camera, Upload, Trash2, Lock, Eye, EyeOff, X, Save, CheckCircle2, Shield } from 'lucide-react';

interface MeuPerfilModalProps {
  isOpen: boolean;
  onClose: () => void;
  usuario: Usuario;
  onUsuarioAtualizado: (usuarioAtualizado: Usuario) => void;
}

export const MeuPerfilModal: React.FC<MeuPerfilModalProps> = ({
  isOpen,
  onClose,
  usuario,
  onUsuarioAtualizado
}) => {
  const { toast } = useToast();

  const [nome, setNome] = useState(usuario.nome || '');
  const [email, setEmail] = useState(usuario.email || '');
  const [fotoUrl, setFotoUrl] = useState<string | undefined>(usuario.foto_url);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNome(usuario.nome || '');
      setEmail(usuario.email || '');
      setFotoUrl(usuario.foto_url);
      setNovaSenha('');
      setConfirmarSenha('');
      setMostrarSenha(false);
    }
  }, [isOpen, usuario]);

  if (!isOpen) return null;

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação de tipo e tamanho (máx 5MB)
    if (!file.type.startsWith('image/')) {
      toast.aviso('Por favor, selecione um arquivo de imagem válido (JPG, PNG ou WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.aviso('A foto de perfil deve possuir no máximo 5MB.');
      return;
    }

    setUploadingFoto(true);
    try {
      const res = await apiService.uploadImagem(file);
      setFotoUrl(res.url);
      toast.sucesso('Foto carregada com sucesso! Clique em "Salvar Alterações" para confirmar.');
    } catch (err: any) {
      toast.erro(err.response?.data?.detail || 'Erro ao fazer upload da foto de perfil');
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleRemoverFoto = () => {
    setFotoUrl('');
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      toast.aviso('Por favor, informe seu nome completo.');
      return;
    }

    if (novaSenha) {
      if (novaSenha.length < 6) {
        toast.aviso('A nova senha deve possuir pelo menos 6 caracteres.');
        return;
      }
      if (novaSenha !== confirmarSenha) {
        toast.aviso('As senhas digitadas não coincidem. Verifique e tente novamente.');
        return;
      }
    }

    setSalvando(true);
    try {
      const payload: { nome: string; email?: string; password?: string; foto_url?: string } = {
        nome: nome.trim(),
        email: email.trim() || undefined,
        foto_url: fotoUrl || ''
      };

      if (novaSenha.trim()) {
        payload.password = novaSenha.trim();
      }

      const usuarioAtualizado = await apiService.atualizarMeuPerfil(payload);
      onUsuarioAtualizado(usuarioAtualizado);
      toast.sucesso('Perfil atualizado com sucesso!');
      onClose();
    } catch (err: any) {
      toast.erro(err.response?.data?.detail || 'Erro ao atualizar seu perfil.');
    } finally {
      setSalvando(false);
    }
  };

  const getPerfilBadge = () => {
    const perfis: Record<string, { label: string; badge: string }> = {
      ADMIN: { label: 'Gerente Geral (Acesso Total)', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
      FINANCEIRO: { label: 'Financeiro & Tesouraria', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
      OPERADOR_CAIXA: { label: 'Operador de Caixa (PDV)', badge: 'bg-sky-100 text-sky-800 border-sky-200' },
      VENDEDOR: { label: 'Vendedor / Balcão', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
      TECNICO: { label: 'Técnico Especialista (OS)', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
      ESTOQUISTA: { label: 'Controlador de Estoque', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
    };
    return perfis[usuario.perfil] || { label: usuario.perfil, badge: 'bg-slate-100 text-slate-800 border-slate-200' };
  };

  const perfilInfo = getPerfilBadge();

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <User size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg leading-tight">Meu Perfil</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Atualize seus dados pessoais, foto e credenciais de acesso
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSalvar} className="space-y-4">
          {/* Seção da Foto de Perfil */}
          <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="relative group shrink-0">
              {fotoUrl ? (
                <img
                  src={resolveImageUrl(fotoUrl)}
                  alt={nome || 'Usuário'}
                  className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-md">
                  {nome ? nome.charAt(0).toUpperCase() : 'U'}
                </div>
              )}

              {uploadingFoto && (
                <div className="absolute inset-0 bg-slate-900/60 rounded-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Foto de Perfil</span>
                <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                  Sua foto aparece no topo do sistema, na barra lateral e nas ordens de serviço.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer shadow-2xs transition-colors">
                  <Camera size={14} className="text-sky-600" />
                  <span>{fotoUrl ? 'Alterar Foto' : 'Adicionar Foto'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadFoto}
                    disabled={uploadingFoto}
                    className="hidden"
                  />
                </label>

                {fotoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoverFoto}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Remover</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Dados do Usuário */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-mail de Acesso
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@empresa.com"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Perfil de Acesso
                </label>
                <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${perfilInfo.badge}`}>
                    {perfilInfo.label}
                  </span>
                  <Shield size={14} className="text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Troca de Senha (Opcional) */}
          <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                <Lock size={14} className="text-sky-600" />
                <span>Alterar Senha de Acesso</span>
              </div>
              <span className="text-[10px] text-slate-400">Deixe em branco para manter a atual</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nova Senha (mín. 6 dígitos)
                </label>
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-9 border border-slate-300 rounded-xl text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-2.5 top-7 text-slate-400 hover:text-slate-600"
                >
                  {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Confirmar Nova Senha
                </label>
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Botões do Rodapé */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || uploadingFoto}
              className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {salvando ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={15} />
              )}
              <span>{salvando ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
