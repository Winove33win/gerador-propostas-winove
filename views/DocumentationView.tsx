
import React from 'react';
import { Database, Network, Key, Workflow, Code, FileText, ShieldCheck, UserPlus } from 'lucide-react';

const DocumentationView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <header className="space-y-4">
        <div className="inline-block px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest">Documentação Oficial v3.0</div>
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Arquitetura & Segurança</h2>
        <p className="text-xl text-slate-500">Manual técnico completo para integração com a API REST, persistência MariaDB e sistema de autenticação tripla da Winove.</p>
      </header>

      {/* Security Info */}
      <section className="bg-blue-600 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row gap-8 items-center">
        <div className="bg-white/20 p-4 rounded-2xl">
          <ShieldCheck size={48} />
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">Segurança: Tripla Autenticação</h3>
          <p className="text-blue-100 text-sm leading-relaxed">
            O sistema implementa uma camada de segurança reforçada exigindo três fatores para o acesso: 
            <b> E-mail cadastrado</b>, <b>CNPJ da Empresa vinculada</b> e <b>Senha pessoal</b>. 
            Isso garante que apenas colaboradores autorizados de empresas parceiras acessem o painel.
          </p>
        </div>
      </section>

      {/* Database Schema */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
          <Database className="text-blue-600" size={24} />
          <h3 className="text-2xl font-bold text-slate-800">1. Esquema Relacional (MariaDB)</h3>
        </div>
        <p className="text-slate-600 text-sm">Estrutura de tabelas otimizada para o motor <b>InnoDB</b>, incluindo gestão de usuários e colaboradores.</p>
        <div className="bg-slate-900 rounded-2xl p-6 overflow-x-auto shadow-xl">
          <pre className="text-emerald-400 font-mono text-xs leading-relaxed">
{`-- Tabela de Usuários (Acesso ao Sistema)
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  cnpj_access VARCHAR(18) NOT NULL,    -- CNPJ que atua como chave de segurança
  password VARCHAR(255) NOT NULL,      -- Senha criptografada
  role ENUM('admin', 'employee') DEFAULT 'employee',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Clientes
CREATE TABLE clients (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  person_name VARCHAR(100),
  job_title VARCHAR(100),
  document VARCHAR(18) UNIQUE,
  email VARCHAR(100),
  phone VARCHAR(20)
);

-- Tabela de Propostas (Simplificada)
CREATE TABLE proposals (
  id CHAR(36) PRIMARY KEY,
  number VARCHAR(50) UNIQUE,
  company_id CHAR(36),
  client_id CHAR(36),
  status ENUM('rascunho', 'enviada', 'aceita', 'recusada'),
  total_value DECIMAL(12,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);`}
          </pre>
        </div>
      </section>

      {/* REST API Endpoints */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
          <Network className="text-blue-600" size={24} />
          <h3 className="text-2xl font-bold text-slate-800">2. Endpoints da API REST</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[
            { method: 'POST', path: '/api/auth/login', desc: 'Valida as 3 credenciais e retorna o token de sessão/usuário' },
            { method: 'POST', path: '/api/auth/register', desc: 'Cadastra novo colaborador (Default role: employee)' },
            { method: 'GET', path: '/api/users', desc: 'Lista todos os colaboradores cadastrados (Apenas Admin)' },
            { method: 'GET', path: '/api/clients', desc: 'Recupera lista de clientes com filtros de busca' },
            { method: 'POST', path: '/api/proposals', desc: 'Cria proposta e gera número sequencial automático' },
            { method: 'GET', path: '/api/proposals/:id/pdf', desc: 'Gera stream do documento PDF personalizado Winove' },
          ].map((route, i) => (
            <div key={i} className="bg-white border border-slate-200 p-5 rounded-2xl flex items-start gap-4 shadow-sm hover:border-blue-300 transition-colors">
              <span className={`px-2.5 py-1 rounded-md text-[9px] font-black tracking-widest ${
                route.method === 'GET' ? 'bg-emerald-50 text-emerald-600' :
                route.method === 'POST' ? 'bg-blue-50 text-blue-600' :
                'bg-amber-50 text-amber-600'
              }`}>{route.method}</span>
              <div>
                <code className="text-sm font-bold text-slate-800">{route.path}</code>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{route.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Payloads */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
          <Code className="text-blue-600" size={24} />
          <h3 className="text-2xl font-bold text-slate-800">3. Exemplos de Payload (JSON)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
                <UserPlus size={16} className="text-blue-600" />
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-tighter">Cadastro de Usuário</h4>
             </div>
             <pre className="text-slate-800 text-[11px] font-mono leading-relaxed">
{`{
  "name": "Fernando Winove",
  "email": "contato@winove.com.br",
  "cnpj_access": "29.900.423/0001-40",
  "password": "sua_senha_aqui",
  "role": "admin"
}`}
             </pre>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
                <Key size={16} className="text-blue-600" />
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-tighter">Login (Credenciais)</h4>
             </div>
             <pre className="text-slate-800 text-[11px] font-mono leading-relaxed">
{`{
  "email": "contato@winove.com.br",
  "cnpj_access": "29900423000140",
  "password": "sua_senha_aqui"
}`}
             </pre>
           </div>
        </div>
      </section>

      {/* Final Note */}
      <footer className="pt-10 border-t border-slate-200 flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-widest">
        <span>Winove Online © 2024 | Sistema Propulsão</span>
        <div className="flex gap-6">
          <a href="#" className="hover:text-blue-600 transition-colors">Audit Logs</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Termos de Uso</a>
        </div>
      </footer>
    </div>
  );
};

export default DocumentationView;
