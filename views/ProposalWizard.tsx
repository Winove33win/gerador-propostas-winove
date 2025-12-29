
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api.ts';
import { Company, Client, Service, Optional, Term, Proposal } from '../types';
import { Check, ChevronRight, ChevronLeft, Save, Download, Hexagon } from 'lucide-react';
import { generateProposalPDF } from '../utils/pdfGenerator';

interface Props {
  id: string | null;
  onComplete: () => void;
  onCancel: () => void;
}

const ProposalWizard: React.FC<Props> = ({ id, onComplete, onCancel }) => {
  const [step, setStep] = useState(1);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedOptionals, setSelectedOptionals] = useState<string[]>([]);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Proposal['status']>('rascunho');
  const [proposalNumber, setProposalNumber] = useState<string | null>(null);

  // New specific fields
  const [deadline, setDeadline] = useState('20 Dias úteis');
  const [portfolioUrl, setPortfolioUrl] = useState('clique aqui');
  const [domain, setDomain] = useState('http://');
  const [platform, setPlatform] = useState('Wix Studio');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [optionalsList, setOptionalsList] = useState<Optional[]>([]);
  const [termsList, setTermsList] = useState<Term[]>([]);

  useEffect(() => {
    const loadLists = async () => {
      try {
        const [companiesResponse, clientsResponse, servicesResponse, optionalsResponse, termsResponse] = await Promise.all([
          api.companies.list(),
          api.clients.list(),
          api.services.list(),
          api.optionals.list(),
          api.terms.list(),
        ]);
        setCompanies(companiesResponse);
        setClients(clientsResponse);
        setServicesList(servicesResponse);
        setOptionalsList(optionalsResponse);
        setTermsList(termsResponse);
      } catch (error) {
        console.warn('Falha ao carregar dados da proposta.', error);
      }
    };

    void loadLists();
  }, []);

  useEffect(() => {
    const loadProposal = async () => {
      if (!id) return;
      try {
        const proposal = await api.proposals.get(id);
        setSelectedCompanyId(proposal.company_id);
        setSelectedClientId(proposal.client_id);
        setSelectedServices(proposal.services_ids || []);
        setSelectedOptionals(proposal.optionals_ids || []);
        setSelectedTerms(proposal.terms_ids || []);
        setDiscount(proposal.discount || 0);
        setNotes(proposal.notes || '');
        setStatus(proposal.status);
        setDeadline(proposal.deadline || '20 Dias úteis');
        setPortfolioUrl(proposal.portfolio_url || '');
        setDomain(proposal.domain || '');
        setPlatform(proposal.platform || '');
        setProposalNumber(proposal.number);
      } catch (error) {
        console.warn('Falha ao carregar proposta.', error);
      }
    };

    void loadProposal();
  }, [id]);

  useEffect(() => {
    if (id || companies.length === 0) return;
    const winove = companies.find(c => c.name === 'Winove Online');
    if (winove && !selectedCompanyId) setSelectedCompanyId(winove.id);
  }, [companies, id, selectedCompanyId]);

  useEffect(() => {
    if (id || termsList.length === 0) return;
    if (selectedTerms.length === 0) {
      setSelectedTerms(termsList.map(t => t.id));
    }
  }, [id, termsList, selectedTerms.length]);

  const totalValue = useMemo(() => {
    const sValue = servicesList.filter(s => selectedServices.includes(s.id)).reduce((acc, curr) => acc + curr.value, 0);
    const oValue = optionalsList.filter(o => selectedOptionals.includes(o.id)).reduce((acc, curr) => acc + curr.value, 0);
    return Math.max(0, sValue + oValue - discount);
  }, [selectedServices, selectedOptionals, discount, servicesList, optionalsList]);

  const handleSave = async () => {
    const proposalData: Omit<Proposal, 'id' | 'number'> = {
      company_id: selectedCompanyId,
      client_id: selectedClientId,
      services_ids: selectedServices,
      optionals_ids: selectedOptionals,
      terms_ids: selectedTerms,
      discount,
      total_value: totalValue,
      status,
      created_at: new Date().toISOString(),
      expiry_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      deadline,
      portfolio_url: portfolioUrl,
      domain,
      platform,
      notes
    };

    try {
      if (id) {
        await api.proposals.update(id, proposalData);
      } else {
        await api.proposals.create(proposalData);
      }
    } catch (error) {
      console.warn('Falha ao salvar proposta.', error);
    }
    onComplete();
  };

  const handlePDFDownload = () => {
    const tempProposal: Proposal = {
      id: id || 'temp',
      number: id ? (proposalNumber || 'PRP-000') : 'PRP-PREVIEW',
      company_id: selectedCompanyId,
      client_id: selectedClientId,
      services_ids: selectedServices,
      optionals_ids: selectedOptionals,
      terms_ids: selectedTerms,
      discount,
      total_value: totalValue,
      status,
      created_at: new Date().toISOString(),
      expiry_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      deadline,
      portfolio_url: portfolioUrl,
      domain,
      platform,
      notes
    };
    void generateProposalPDF(tempProposal);
  };

  const steps = [
    { num: 1, title: 'Envolvidos' },
    { num: 2, title: 'Configuração' },
    { num: 3, title: 'Itens & Termos' },
    { num: 4, title: 'Revisão' },
  ];

  const inputClasses = "w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all";
  const labelClasses = "block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider";

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Hexagon size={40} className="text-blue-600 fill-blue-50" />
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{id ? 'Editar Proposta' : 'Nova Proposta Winove'}</h2>
            <p className="text-blue-500 text-xs font-bold uppercase tracking-widest">Escopo Digital Personalizado</p>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-all text-sm font-medium">Cancelar</button>
           <button onClick={handleSave} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-bold shadow-md transition-all">
             <Save size={18} />
             Salvar No Banco
           </button>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between max-w-2xl mx-auto px-4">
        {steps.map((s, idx) => (
          <React.Fragment key={s.num}>
            <div className="flex flex-col items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                step >= s.num ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-200 text-slate-500'
              }`}>
                {step > s.num ? <Check size={18} /> : s.num}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${step >= s.num ? 'text-blue-700' : 'text-slate-400'}`}>{s.title}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-4 rounded-full transition-all duration-500 ${step > s.num ? 'bg-blue-600' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 min-h-[400px]">
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-500 uppercase">Sua Empresa</label>
              <div className="grid gap-3">
                {companies.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => setSelectedCompanyId(c.id)}
                    className={`p-4 border rounded-xl text-left transition-all ${selectedCompanyId === c.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/10' : 'hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <p className="font-bold text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.cnpj}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-500 uppercase">Cliente</label>
              <div className="grid gap-3">
                {clients.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => setSelectedClientId(c.id)}
                    className={`p-4 border rounded-xl text-left transition-all ${selectedClientId === c.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/10' : 'hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <p className="font-bold text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.document}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Configurações do Projeto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClasses}>Prazo de Entrega</label>
                <input 
                  className={inputClasses} 
                  value={deadline} 
                  onChange={e => setDeadline(e.target.value)}
                  placeholder="Ex: 20 Dias úteis"
                />
              </div>
              <div>
                <label className={labelClasses}>Plataforma</label>
                <input 
                  className={inputClasses} 
                  value={platform} 
                  onChange={e => setPlatform(e.target.value)}
                  placeholder="Ex: Wix Studio"
                />
              </div>
              <div>
                <label className={labelClasses}>Domínio</label>
                <input 
                  className={inputClasses} 
                  value={domain} 
                  onChange={e => setDomain(e.target.value)}
                  placeholder="Ex: http://www.site.com.br"
                />
              </div>
              <div>
                <label className={labelClasses}>Link Portfólio</label>
                <input 
                  className={inputClasses} 
                  value={portfolioUrl} 
                  onChange={e => setPortfolioUrl(e.target.value)}
                  placeholder="Link para o portfólio"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest">Catálogo de Serviços</label>
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {servicesList.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => setSelectedServices(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                    className={`p-4 border rounded-xl cursor-pointer flex justify-between items-center transition-all ${selectedServices.includes(s.id) ? 'border-blue-500 bg-blue-50' : 'hover:bg-slate-50 border-slate-200'}`}
                  >
                    <div>
                      <p className="font-bold text-slate-800">{s.description}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{s.unit}</p>
                    </div>
                    <p className="font-bold text-blue-600 text-sm">R$ {s.value.toLocaleString('pt-BR')}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest">Termos Contratuais ({selectedTerms.length} ativos)</label>
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {termsList.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => setSelectedTerms(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                    className={`p-4 border rounded-xl cursor-pointer transition-all ${selectedTerms.includes(t.id) ? 'border-blue-500 bg-blue-50' : 'hover:bg-slate-50 border-slate-200'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedTerms.includes(t.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                        {selectedTerms.includes(t.id) && <Check size={10} />}
                      </div>
                      <span className="font-bold text-xs text-slate-700">{t.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col lg:flex-row gap-10">
            <div className="flex-1 space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                  <h4 className="font-bold text-slate-800">Revisão Final</h4>
                  <button 
                    onClick={handlePDFDownload}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all"
                  >
                    <Download size={14} />
                    Gerar PDF Winove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Status da Negociação</label>
                    <select 
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={status}
                      onChange={e => setStatus(e.target.value as any)}
                    >
                      <option value="rascunho">Rascunho</option>
                      <option value="enviada">Enviada ao Cliente</option>
                      <option value="aceita">Aceita (Fechada)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Ajuste de Valor (Desconto)</label>
                    <input 
                      type="number"
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={discount} 
                      onChange={e => setDiscount(Number(e.target.value))} 
                    />
                  </div>
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Nota Técnica para o Cliente</label>
                   <textarea 
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                    rows={4}
                    placeholder="Ex: Conteúdos e imagens devem ser fornecidos em alta qualidade..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="w-full lg:w-80 bg-slate-900 text-white rounded-2xl p-6 h-fit border border-blue-500/20 shadow-2xl shadow-blue-500/10">
              <div className="flex items-center gap-2 mb-6 opacity-80">
                <Hexagon size={20} className="text-blue-500 fill-blue-500/20" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">WIN OVE</span>
              </div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Investimento Estimado</h4>
              <div className="space-y-3 border-b border-slate-800 pb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Valor Bruto:</span>
                  <span className="font-mono text-slate-200">R$ {(totalValue + discount).toLocaleString('pt-BR')}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-xs text-rose-400">
                    <span>Bonificação:</span>
                    <span className="font-mono">- R$ {discount.toLocaleString('pt-BR')}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Termos Vinculados:</span>
                  <span className="font-mono text-slate-200">{selectedTerms.length} Cláusulas</span>
                </div>
              </div>
              <div className="pt-4 flex justify-between items-center">
                <span className="text-xs font-bold text-blue-400">TOTAL:</span>
                <span className="text-2xl font-black text-white">R$ {totalValue.toLocaleString('pt-BR')}</span>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-3 text-slate-400">
                 <div className="text-[8px] leading-relaxed italic text-slate-500">
                    Esta proposta expira em 15 dias corridos. Prazo de execução estimado em {deadline}.
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-100 shadow-sm sticky bottom-8">
        <button 
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${step === 1 ? 'opacity-0 pointer-events-none' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          <ChevronLeft size={18} />
          Voltar
        </button>

        <div className="flex gap-4">
           {step === 4 ? (
             <button 
              onClick={handleSave}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-10 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all transform hover:scale-[1.02]"
             >
               Salvar e Finalizar
               <Check size={18} />
             </button>
           ) : (
             <button 
              onClick={() => setStep(s => Math.min(4, s + 1))}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-10 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all transform hover:scale-[1.02]"
             >
               Continuar
               <ChevronRight size={18} />
             </button>
           )}
        </div>
      </div>
    </div>
  );
};

export default ProposalWizard;
