
import React, { useState } from 'react';
import { api } from '../api.ts';
import { Hexagon, Lock, Mail, Building2, AlertCircle, KeyRound, UserPlus, User as UserIcon, CheckCircle2 } from 'lucide-react';
import { User } from '../types';

interface Props {
  onLoginSuccess: (user: User) => void;
}

const LoginView: React.FC<Props> = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      const user = await api.auth.login(email, password);
      onLoginSuccess(user);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    if (!name || !email || !cnpj || !password) {
      setError('Todos os campos são obrigatórios.');
      setLoading(false);
      return;
    }

    try {
      const newUser = await api.auth.register({
        name,
        email,
        cnpj_access: cnpj,
        password,
      });

      setSuccess('Conta criada com sucesso! Redirecionando para o painel...');
      setTimeout(() => {
        onLoginSuccess(newUser);
      }, 1200);
    } catch (error) {
      setError('Erro ao criar conta. Tente novamente.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (isRegistering) {
      await handleRegister();
    } else {
      await handleLogin();
    }
  };

  const inputClasses = "w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600";
  const labelClasses = "text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1";

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Elementos Decorativos de Fundo */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md z-10 animate-in fade-in zoom-in duration-500">
        <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <Hexagon size={64} className="text-blue-500 fill-blue-500/10" />
              <div className="absolute inset-0 flex items-center justify-center text-xl font-black text-white">W</div>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Winove Online</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-1">
              {isRegistering ? 'Criação de Acesso' : 'Acesso Restrito'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegistering && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <label className={labelClasses}>Nome Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="text" 
                    required
                    className={inputClasses}
                    placeholder="Seu nome"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className={labelClasses}>E-mail Profissional</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="email" 
                  required
                  className={inputClasses}
                  placeholder="ex: voce@winove.com.br"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            {isRegistering && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <label className={labelClasses}>CNPJ da Empresa</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="text"
                    required
                    className={inputClasses}
                    placeholder="00.000.000/0001-00"
                    value={cnpj}
                    onChange={e => setCnpj(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className={labelClasses}>Senha</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="password" 
                  required
                  className={inputClasses}
                  placeholder="Sua senha secreta"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            {isRegistering && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <label className={labelClasses}>Confirmar Senha</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="password" 
                    required
                    className={inputClasses}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-rose-400 bg-rose-400/10 p-3 rounded-xl border border-rose-400/20 text-xs animate-in shake duration-300">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 p-3 rounded-xl border border-emerald-400/20 text-xs animate-in slide-in-from-top-1">
                <CheckCircle2 size={16} />
                <span>{success}</span>
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  {isRegistering ? 'Criar minha conta' : 'Entrar no Sistema'}
                  {isRegistering ? <UserPlus size={18} /> : <Lock size={18} />}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-4">
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
                setSuccess('');
              }}
              className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
            >
              {isRegistering ? 'Já tenho uma conta? Entrar agora' : 'Não tem conta? Cadastrar colaborador'}
            </button>

            <p className="text-center text-[10px] text-slate-500 leading-relaxed max-w-[280px]">
              O acesso é restrito a colaboradores autorizados da Winove Online.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
