import React, { useState } from 'react';
import { apiService } from '../services/api';
import { Lock, Mail, Store, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (usuario: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@gestao.com');
  const [password, setPassword] = useState('admin123');
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

  const setDemoCredentials = (tipo: 'admin' | 'caixa' | 'estoque') => {
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
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-500 shadow-lg shadow-sky-500/30 text-white mb-4">
            <Store size={34} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sistema de Gestão & PDV</h1>
          <p className="text-slate-400 text-sm mt-1">Acesso online para pequenos e médios negócios</p>
        </div>

        {/* Card de Login */}
        <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-xl">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-300 text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                E-mail de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm transition-all"
                />
              </div>
            </div>

            {/* Checkbox Lembrar-me */}
            <div className="flex items-center gap-2 pt-1 pb-1">
              <input
                type="checkbox"
                id="lembrar"
                checked={lembrar}
                onChange={(e) => setLembrar(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-700 bg-slate-900"
              />
              <label htmlFor="lembrar" className="text-xs text-slate-400 select-none cursor-pointer">
                Lembrar meu acesso neste computador (desmarque para fechar a sessão ao sair)
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition-all disabled:opacity-50"
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

          {/* Atalhos para Demo */}
          <div className="mt-6 pt-5 border-t border-slate-700/60 text-center">
            <p className="text-xs text-slate-400 mb-3 flex items-center justify-center gap-1.5">
              <ShieldCheck size={14} className="text-sky-400" />
              Acesso rápido com dados de demonstração:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDemoCredentials('admin')}
                className="px-2 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-600/40 transition-colors truncate"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('estoque')}
                className="px-2 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-600/40 transition-colors truncate"
              >
                Estoquista
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('caixa')}
                className="px-2 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-600/40 transition-colors truncate"
              >
                Caixa
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

