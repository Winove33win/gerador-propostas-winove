
import React from 'react';
import { 
  Database, 
  Network, 
  Key, 
  Workflow, 
  Code, 
  FileText, 
  ShieldCheck, 
  UserPlus, 
  Server, 
  Settings, 
  Terminal,
  Layers,
  HardDrive
} from 'lucide-react';

const DocumentationView: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-32">
      {/* HEADER DINÂMICO */}
      <header className="space-y-6 border-b border-slate-200 pb-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Layers size={24} />
          </div>
          <div className="inline-block px-4 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
            Documentação Master v4.0
          </div>
        </div>
        <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-tight">
          Sistema de Propulsão <br/> 
          <span className="text-blue-600 italic">Winove Online</span>
        </h2>
        <p className="text-xl text-slate-500 max-w-3xl leading-relaxed">
          Guia completo de engenharia para o sistema de gestão de propostas. Abrange desde o provisionamento no Plesk até a estrutura relacional do MariaDB e fluxos de segurança.
        </p>
      </header>

      {/* 1. INFRAESTRUTURA PLESK & NODE.JS */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <Server className="text-blue-600" size={32} />
          <h3 className="text-3xl font-bold text-slate-800 tracking-tight">1. Infraestrutura do Servidor</h3>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Terminal size={120} />
            </div>
            <h4 className="text-blue-400 font-black uppercase text-xs tracking-widest mb-6">Configuração do Ambiente (Plesk)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 text-sm">
              <div className="space-y-1">
                <span className="text-slate-500 block">Domínio de Operação</span>
                <span className="font-mono text-emerald-400">controle.winove.com.br</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Versão do Node.js</span>
                <span className="font-mono text-emerald-400">22.21.1 (Stable)</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Gerenciador de Pacotes</span>
                <span className="font-mono text-emerald-400">npm (detectado automaticamente)</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Modo de Execução</span>
                <span className="font-mono text-emerald-400">production</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Arquivo Inicial</span>
                <span className="font-mono text-emerald-400">controle.winove.com.br/app.js</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Diretório Root</span>
                <span className="font-mono text-slate-400 text-xs">/httpdocs (root da aplicação)</span>
              </div>
            </div>
            <div className="mt-8 rounded-2xl border border-blue-500/30 bg-blue-900/40 p-5 text-xs text-blue-100 leading-relaxed">
              <div className="font-black uppercase tracking-widest text-[10px] text-blue-300">Nota operacional</div>
              <p className="mt-3">
                No Plesk, mantenha o gerenciamento do processo ativo apenas pelo painel. Antes de
                executar qualquer <span className="font-mono">npm run start</span> manual, pare o processo
                existente e volte a iniciar pelo Plesk para evitar conflitos de porta.
              </p>
              <p className="mt-3">
                A porta é fornecida pela variável <span className="font-mono">PORT</span> do Plesk e o
                backend já consome <span className="font-mono">process.env.PORT</span>. Se houver outro
                serviço usando a porta, ajuste o <span className="font-mono">PORT</span> no painel ou
                libere a porta ocupada.
              </p>
              <p className="mt-3">
                Sem Plesk, mantenha o banco local usando <span className="font-mono">DB_HOST=127.0.0.1</span>
                (ou <span className="font-mono">localhost</span>) e garanta que o usuário do MySQL tenha
                grants para <span className="font-mono">localhost</span>. Isso elimina o warning e evita
                falhas de conexão por <span className="font-mono">bind-address</span> ou firewall.
              </p>
            </div>
          </div>

          <div className="bg-white border-2 border-slate-100 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="text-blue-600" size={20} />
              <h4 className="font-bold text-slate-800">Variáveis NPM Personalizadas</h4>
            </div>
            <div className="space-y-3">
              {[
                { k: 'NODE_ENV', v: 'production' },
                { k: 'PORT', v: 'definido pelo Plesk' },
                { k: 'APP_URL', v: 'http://controle.winove.com.br' },
                { k: 'DB_HOST', v: 'localhost' },
                { k: 'DB_PORT', v: '3306' }
              ].map((item, i) => (
                <div key={i} className="flex flex-col p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{item.k}</span>
                  <span className="text-xs font-mono text-blue-600">{item.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. PERSISTÊNCIA MARIADB & SQL SCRIPTS */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <Database className="text-blue-600" size={32} />
          <h3 className="text-3xl font-bold text-slate-800 tracking-tight">2. Banco de Dados MariaDB</h3>
        </div>

        <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl overflow-hidden shadow-lg">
          <div className="p-6 bg-white border-b border-slate-200 flex flex-wrap gap-8">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Database Name</span>
              <span className="font-mono font-bold text-blue-700">propostas-winove</span>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">User</span>
              <span className="font-mono font-bold text-blue-700">winove-controle</span>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Password</span>
              <span className="font-mono font-bold text-rose-600">amilase1234@</span>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Access Control</span>
              <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-black uppercase">Remote Connections OK</span>
            </div>
          </div>

          <div className="p-8 space-y-6 bg-slate-900">
             <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Terminal size={18} />
                <span className="text-xs font-black uppercase tracking-widest">DDL SQL - Scripts de Criação</span>
             </div>
             <pre className="text-emerald-400 font-mono text-xs leading-relaxed overflow-x-auto">
{`-- 1. Tabela de Segurança e Autenticação
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  login VARCHAR(100) UNIQUE NOT NULL,
  cnpj_access VARCHAR(18) NOT NULL, -- Chave de segurança tripla
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'employee') DEFAULT 'employee',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Clientes
CREATE TABLE clients (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  document VARCHAR(18) UNIQUE NOT NULL, -- CPF ou CNPJ
  address TEXT,
  person_name VARCHAR(100),
  job_title VARCHAR(100),
  phone VARCHAR(20)
);

-- 3. Tabela de Propostas (Cabeçalho)
CREATE TABLE proposals (
  id CHAR(36) PRIMARY KEY,
  number VARCHAR(50) UNIQUE NOT NULL,
  client_id CHAR(36),
  company_id CHAR(36),
  status ENUM('rascunho', 'enviada', 'aceita', 'recusada') DEFAULT 'rascunho',
  total_value DECIMAL(12,2),
  discount DECIMAL(12,2) DEFAULT 0.00,
  deadline VARCHAR(100),
  portfolio_url VARCHAR(255),
  domain VARCHAR(255),
  platform VARCHAR(100),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expiry_date DATETIME,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- 4. Tabelas de Relacionamento (Muitos para Muitos)
CREATE TABLE proposal_services (
  proposal_id CHAR(36),
  service_id CHAR(36),
  PRIMARY KEY (proposal_id, service_id)
);

CREATE TABLE proposal_terms (
  proposal_id CHAR(36),
  term_id CHAR(36),
  PRIMARY KEY (proposal_id, term_id)
);`}
             </pre>
          </div>
        </div>
      </section>

      {/* 3. SEGURANÇA & API */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <ShieldCheck className="text-blue-600" size={32} />
          <h3 className="text-3xl font-bold text-slate-800 tracking-tight">3. Segurança e Protocolos REST</h3>
        </div>

        <div className="bg-blue-600 rounded-3xl p-10 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
            <div className="w-24 h-24 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
               <Key size={48} />
            </div>
            <div className="space-y-4">
              <h4 className="text-2xl font-black">Autenticação por E-mail e Senha</h4>
              <p className="text-blue-100 leading-relaxed">
                O login utiliza apenas <b>e-mail profissional</b> e <b>senha criptografada</b>.
                O CNPJ é informado no cadastro do colaborador e permanece associado ao usuário.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <span className="bg-white/10 px-4 py-2 rounded-xl text-xs font-bold border border-white/20">Fator 1: Identificador Profissional</span>
                <span className="bg-white/10 px-4 py-2 rounded-xl text-xs font-bold border border-white/20">Fator 2: Senha Criptografada</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
               <Network size={16} className="text-blue-600" />
               Principais Endpoints da API
            </h4>
            <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {[
                { m: 'POST', p: '/auth/login', d: 'Autenticação por e-mail e senha e geração de JWT' },
                { m: 'POST', p: '/api/auth/register', d: 'Criação de novos colaboradores (Employee)' },
                { m: 'GET', p: '/clients', d: 'Listagem de clientes para o Wizard' },
                { m: 'POST', p: '/proposals', d: 'Persistência de nova proposta comercial' },
                { m: 'GET', p: '/proposals/:id/pdf', d: 'Engine de renderização jsPDF Winove' },
              ].map((r, i) => (
                <div key={i} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <span className={`text-[10px] font-black px-2 py-1 rounded ${r.m === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{r.m}</span>
                  <div>
                    <code className="text-xs font-bold text-slate-800">{r.p}</code>
                    <p className="text-[10px] text-slate-500 mt-0.5">{r.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
               <Code size={16} className="text-blue-600" />
               Payload de Autenticação (Exemplo)
            </h4>
            <div className="bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-800">
               <pre className="text-blue-300 font-mono text-[11px] leading-relaxed">
{`{
  "auth": {
    "email": "usuario@empresa.com",
    "password": "**************"
  },
  "context": {
    "ip": "186.232.XX.XX",
    "agent": "Plesk_Node_Env"
  }
}`}
               </pre>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL FOOTER */}
      <footer className="pt-16 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
              <HardDrive size={24} />
           </div>
           <div>
              <p className="text-xs font-black text-slate-900 uppercase">Winove Online Core</p>
              <p className="text-[10px] text-slate-500">Desenvolvido para alta performance comercial.</p>
           </div>
        </div>
        <div className="flex gap-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
           <a href="#" className="hover:text-blue-600">Privacy Policy</a>
           <a href="#" className="hover:text-blue-600">API Uptime</a>
           <a href="#" className="hover:text-blue-600">Support</a>
        </div>
      </footer>
    </div>
  );
};

export default DocumentationView;
