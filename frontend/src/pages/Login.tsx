import React, { useState } from 'react';
import { apiService } from '../services/api';
import { 
  Lock, Mail, Store, AlertCircle, ArrowRight, ShieldCheck, 
  Eye, EyeOff, UserCheck, Shield, ShoppingCart, Package, Sparkles
} from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (usuario: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  // Em produção (Netlify / build), DEV é false: tela limpa sem atalhos ou credenciais pré-preenchidas
  const isDev = import.meta.env.DEV;

  const [email, setEmail] = useState(isDev ? 'admin@gestao.com' : '');
  const [password, setPassword] = useState(isDev ? 'admin123' : '');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [perfilAtivo, setPerfilAtivo] = useState<'admin' | 'caixa' | 'estoque' | null>(isDev ? 'admin' : null);
  const [lembrar, setLembrar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await apiService.login(email, password, lembrar);
      onLoginSuccess(data.usuario);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao realizar login. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  const selecionarPerfilDemo = (tipo: 'admin' | 'caixa' | 'estoque') => {
    setPerfilAtivo(tipo);
    if (tipo === 'admin') {
      setEmail('admin@gestao.com');
      setPassword('admin123');
    } else if (tipo === 'caixa') {
      setEmail('caixa@gestao.com');
      setPassword('caixa123');
    } else {
      setEmail('estoque@gestao.com');
      setPassword('estoque123');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-center items-center p-4 relative overflow-hidden text-slate-100">
      {/* Luz ambiente de fundo (Blur Glows) */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg z-10 space-y-6">
        {/* Topo / Logotipo e Apresentação */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-sky-600 to-indigo-500 shadow-xl shadow-sky-500/20 text-white border border-white/20">
            <Store size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Sistema de Gestão & PDV
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Plataforma Comercial Multi-Segmento com Frente de Caixa, Estoque e Ponto CLT
            </p>
          </div>
        </div>

        {/* Card Principal de Login Glassmorphic */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-300 text-xs animate-in fade-in">
              <AlertCircle size={18} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Seletor Rápido de Cargo / Perfil apenas em AMBIENTE DE DESENVOLVIMENTO */}
          {isDev && (
            <div className="space-y-2 p-3 bg-slate-800/40 border border-slate-700/60 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">
                  Atalhos Rápidos de Acesso:
                </span>
                <span className="text-[9px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full font-mono font-bold">
                  DEV ONLY
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => selecionarPerfilDemo('admin')}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    perfilAtivo === 'admin'
                      ? 'bg-gradient-to-b from-sky-500/20 to-sky-600/10 border-sky-500/50 shadow-md shadow-sky-500/10'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Shield size={16} className={perfilAtivo === 'admin' ? 'text-sky-400' : 'text-slate-400'} />
                    {perfilAtivo === 'admin' && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
                  </div>
                  <div>
                    <span className={`block font-bold text-xs ${perfilAtivo === 'admin' ? 'text-white' : 'text-slate-300'}`}>
                      Gerente
                    </span>
                    <span className="text-[10px] text-slate-400 block leading-tight">
                      Acesso Total
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => selecionarPerfilDemo('caixa')}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    perfilAtivo === 'caixa'
                      ? 'bg-gradient-to-b from-emerald-500/20 to-emerald-600/10 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <ShoppingCart size={16} className={perfilAtivo === 'caixa' ? 'text-emerald-400' : 'text-slate-400'} />
                    {perfilAtivo === 'caixa' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  </div>
                  <div>
                    <span className={`block font-bold text-xs ${perfilAtivo === 'caixa' ? 'text-white' : 'text-slate-300'}`}>
                      Operador
                    </span>
                    <span className="text-[10px] text-slate-400 block leading-tight">
                      PDV, Caixa & OS
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => selecionarPerfilDemo('estoque')}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    perfilAtivo === 'estoque'
                      ? 'bg-gradient-to-b from-amber-500/20 to-amber-600/10 border-amber-500/50 shadow-md shadow-amber-500/10'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Package size={16} className={perfilAtivo === 'estoque' ? 'text-amber-400' : 'text-slate-400'} />
                    {perfilAtivo === 'estoque' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </div>
                  <div>
                    <span className={`block font-bold text-xs ${perfilAtivo === 'estoque' ? 'text-white' : 'text-slate-300'}`}>
                      Controlador
                    </span>
                    <span className="text-[10px] text-slate-400 block leading-tight">
                      Gestão de Estoque
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                E-mail Profissional
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@gestao.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Checkbox Lembrar-me */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="lembrar"
                checked={lembrar}
                onChange={(e) => setLembrar(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-700 bg-slate-950"
              />
              <label htmlFor="lembrar" className="text-xs text-slate-400 select-none cursor-pointer">
                Lembrar meu acesso neste dispositivo
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Autenticando...</span>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Rodapé Informativo */}
        <p className="text-center text-[11px] text-slate-500">
          Suporte multiusuário ativo: Gerentes, Operadores de Caixa e Controladores de Estoque.
        </p>
      </div>
    </div>
  );
};
