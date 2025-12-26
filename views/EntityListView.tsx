
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { api } from '../api';
import { Client, EntityType } from '../types';
import { Plus, Search, Edit3, Trash2, Download } from 'lucide-react';
import { generateProposalPDF } from '../utils/pdfGenerator';

interface Props {
  entity: EntityType;
  onEdit: (id: string) => void;
}

const EntityListView: React.FC<Props> = ({ entity, onEdit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [editMode, setEditMode] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [clientLookup, setClientLookup] = useState<Record<string, Client>>({});

  const loadData = useCallback(async () => {
    try {
      let items: any[] = [];
      switch (entity) {
        case 'company':
          items = await api.companies.list();
          break;
        case 'client':
          items = await api.clients.list();
          break;
        case 'service':
          items = await api.services.list();
          break;
        case 'optional':
          items = await api.optionals.list();
          break;
        case 'term':
          items = await api.terms.list();
          break;
        case 'proposal':
          items = await api.proposals.list();
          break;
        case 'user':
          items = await api.users.list();
          break;
        default:
          items = [];
      }
      setData(items);
    } catch (error) {
      console.warn('Falha ao carregar dados da lista.', error);
    }
  }, [entity]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const loadClients = async () => {
      if (entity !== 'proposal') return;
      try {
        const clients = await api.clients.list();
        const lookup = clients.reduce<Record<string, Client>>((acc, client) => {
          acc[client.id] = client;
          return acc;
        }, {});
        setClientLookup(lookup);
      } catch (error) {
        console.warn('Falha ao carregar clientes para propostas.', error);
      }
    };

    void loadClients();
  }, [entity]);

  const filteredData = useMemo(() => {
    return data.filter((item: any) => {
      const searchStr = searchTerm.toLowerCase();
      if (entity === 'service' || entity === 'optional') return item.description.toLowerCase().includes(searchStr);
      if (entity === 'term') return item.title.toLowerCase().includes(searchStr);
      if (entity === 'proposal') return item.number.toLowerCase().includes(searchStr);
      return item.name?.toLowerCase().includes(searchStr) || item.email?.toLowerCase().includes(searchStr);
    });
  }, [data, searchTerm, entity]);

  // Refactored handleSave to avoid dynamic key access which was causing TS errors
  const handleSave = async () => {
    try {
      if (editMode) {
        switch (entity) {
          case 'company':
            await api.companies.update(formData.id, formData);
            break;
          case 'client':
            await api.clients.update(formData.id, formData);
            break;
          case 'service':
            await api.services.update(formData.id, formData);
            break;
          case 'optional':
            await api.optionals.update(formData.id, formData);
            break;
          case 'term':
            await api.terms.update(formData.id, formData);
            break;
          case 'proposal':
            await api.proposals.update(formData.id, formData);
            break;
          case 'user':
            await api.users.update(formData.id, formData);
            break;
          default:
            break;
        }
      } else {
        switch (entity) {
          case 'company':
            await api.companies.create(formData);
            break;
          case 'client':
            await api.clients.create(formData);
            break;
          case 'service':
            await api.services.create(formData);
            break;
          case 'optional':
            await api.optionals.create(formData);
            break;
          case 'term':
            await api.terms.create(formData);
            break;
          case 'proposal':
            await api.proposals.create(formData);
            break;
          case 'user':
            await api.users.create(formData);
            break;
          default:
            break;
        }
      }
      await loadData();
    } catch (error) {
      console.warn('Falha ao salvar registro.', error);
    }
    setShowModal(false);
    setFormData({});
  };

  // Refactored handleDelete to avoid dynamic key access which was causing TS errors
  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir este item?')) {
      try {
        switch (entity) {
          case 'company':
            await api.companies.delete(id);
            break;
          case 'client':
            await api.clients.delete(id);
            break;
          case 'service':
            await api.services.delete(id);
            break;
          case 'optional':
            await api.optionals.delete(id);
            break;
          case 'term':
            await api.terms.delete(id);
            break;
          case 'proposal':
            await api.proposals.delete(id);
            break;
          case 'user':
            await api.users.delete(id);
            break;
          default:
            break;
        }
        await loadData();
      } catch (error) {
        console.warn('Falha ao remover registro.', error);
      }
    }
  };

  const renderFormFields = () => {
    const inputClasses = "w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all";
    const labelClasses = "block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-tight";

    if (entity === 'user') {
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClasses}>Nome Completo</label>
            <input 
              className={inputClasses} 
              value={formData.name || ''} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="Nome do colaborador"
            />
          </div>
          <div>
            <label className={labelClasses}>E-mail</label>
            <input 
              className={inputClasses} 
              value={formData.email || ''} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
              placeholder="email@winove.com.br"
            />
          </div>
          <div>
            <label className={labelClasses}>CNPJ da Empresa (Acesso)</label>
            <input 
              className={inputClasses} 
              value={formData.cnpj_access || ''} 
              onChange={e => setFormData({...formData, cnpj_access: e.target.value})} 
              placeholder="00.000.000/0001-00"
            />
          </div>
          <div>
            <label className={labelClasses}>Senha</label>
            <input 
              type="password"
              className={inputClasses} 
              value={formData.password || ''} 
              onChange={e => setFormData({...formData, password: e.target.value})} 
              placeholder="Defina uma senha"
            />
          </div>
          <div>
            <label className={labelClasses}>Cargo</label>
            <select 
              className={inputClasses}
              value={formData.role || 'employee'}
              onChange={e => setFormData({...formData, role: e.target.value})}
            >
              <option value="employee">Funcionário</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
      );
    }

    if (entity === 'company' || entity === 'client') {
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClasses}>Nome / Razão Social da Empresa</label>
            <input 
              className={inputClasses} 
              value={formData.name || ''} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="Digite o nome da empresa"
            />
          </div>
          {entity === 'client' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClasses}>Nome do Contato</label>
                <input 
                  className={inputClasses} 
                  value={formData.person_name || ''} 
                  onChange={e => setFormData({...formData, person_name: e.target.value})} 
                  placeholder="Nome do responsável"
                />
              </div>
              <div>
                <label className={labelClasses}>Cargo</label>
                <input 
                  className={inputClasses} 
                  value={formData.job_title || ''} 
                  onChange={e => setFormData({...formData, job_title: e.target.value})} 
                  placeholder="Ex: Diretor de Marketing"
                />
              </div>
            </div>
          )}
          <div>
            <label className={labelClasses}>{entity === 'company' ? 'CNPJ' : 'CNPJ / CPF'}</label>
            <input 
              className={inputClasses} 
              value={formData.cnpj || formData.document || ''} 
              onChange={e => setFormData({...formData, [entity === 'company' ? 'cnpj' : 'document']: e.target.value})} 
              placeholder="00.000.000/0001-00"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Email de Contato</label>
              <input className={inputClasses} value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="exemplo@email.com" />
            </div>
            <div>
              <label className={labelClasses}>Telefone</label>
              <input className={inputClasses} value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(00) 00000-0000" />
            </div>
          </div>
          {entity === 'company' && (
             <div>
                <label className={labelClasses}>Dados Bancários / Pagamento</label>
                <textarea 
                  className={inputClasses} 
                  rows={2}
                  value={formData.bank_info || ''} 
                  onChange={e => setFormData({...formData, bank_info: e.target.value})} 
                  placeholder="PIX, Agência, Conta..."
                />
             </div>
          )}
        </div>
      );
    }
    if (entity === 'service' || entity === 'optional') {
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClasses}>Título do Serviço</label>
            <input 
              className={inputClasses} 
              value={formData.description || ''} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              placeholder="Ex: Consultoria de Marketing"
            />
          </div>
          <div>
            <label className={labelClasses}>Descrição Detalhada (Texto para o PDF)</label>
            <textarea 
              className={inputClasses} 
              rows={3}
              value={formData.detailed_description || ''} 
              onChange={e => setFormData({...formData, detailed_description: e.target.value})} 
              placeholder="Descreva o escopo técnico do serviço..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Valor Unitário (R$)</label>
              <input 
                type="number"
                className={inputClasses} 
                value={formData.value || ''} 
                onChange={e => setFormData({...formData, value: Number(e.target.value)})} 
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelClasses}>Tipo de Cobrança</label>
              <select 
                className={inputClasses}
                value={formData.unit || 'fixo'}
                onChange={e => setFormData({...formData, unit: e.target.value})}
              >
                <option value="fixo">Valor Único</option>
                <option value="projeto">Por Projeto</option>
                <option value="anual">Anual</option>
                <option value="mensal">Mensal</option>
              </select>
            </div>
          </div>
          <div>
             <label className={labelClasses}>Principais Benefícios (Um por linha)</label>
             <textarea 
               className={inputClasses} 
               rows={3}
               placeholder="Vantagem 1&#10;Vantagem 2..."
               value={formData.benefits?.join('\n') || ''} 
               onChange={e => setFormData({...formData, benefits: e.target.value.split('\n').filter(Boolean)})} 
             />
          </div>
        </div>
      );
    }
    if (entity === 'term') {
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClasses}>Título da Cláusula</label>
            <input 
              className={inputClasses} 
              value={formData.title || ''} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
              placeholder="Ex: 1. Objeto do Contrato"
            />
          </div>
          <div>
            <label className={labelClasses}>Conteúdo Jurídico</label>
            <textarea 
              rows={8}
              className={inputClasses} 
              value={formData.content || ''} 
              onChange={e => setFormData({...formData, content: e.target.value})} 
              placeholder="Insira o texto legal aqui..."
            />
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 capitalize">{entity === 'proposal' ? 'Propostas' : entity === 'user' ? 'Usuários' : entity + 's'}</h2>
          <p className="text-slate-500 text-sm">Administração de recursos Winove Online.</p>
        </div>
        {entity !== 'proposal' && (
          <button 
            onClick={() => { setEditMode(false); setFormData({}); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-all"
          >
            <Plus size={18} />
            Novo Registro
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Identificação</th>
                {entity === 'proposal' && <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>}
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm italic">Nenhum dado encontrado para exibição.</td>
                </tr>
              ) : (
                filteredData.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700">
                        {entity === 'service' || entity === 'optional' ? item.description :
                         entity === 'term' ? item.title :
                         entity === 'proposal' ? `${item.number} - ${clientLookup[item.client_id]?.name || 'Cliente Removido'}` :
                         entity === 'user' ? item.name :
                         item.name}
                      </div>
                      <div className="text-[10px] text-slate-400 italic">
                        {entity === 'term' ? (item.content?.substring(0, 100) + '...') : 
                         entity === 'client' ? (item.person_name ? `${item.person_name} (${item.job_title})` : item.document) :
                         entity === 'user' ? `${item.email} | ${item.role}` :
                         (item.cnpj || item.document || (item.unit ? `Modelo: ${item.unit}` : ''))}
                      </div>
                    </td>
                    {entity === 'proposal' && (
                      <td className="px-6 py-4">
                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${
                          item.status === 'aceita' ? 'bg-emerald-50 text-emerald-600' :
                          item.status === 'enviada' ? 'bg-blue-50 text-blue-600' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        {entity === 'proposal' && (
                          <button onClick={() => void generateProposalPDF(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all" title="Gerar PDF"><Download size={16} /></button>
                        )}
                        <button 
                          onClick={() => {
                            if (entity === 'proposal') onEdit(item.id);
                            else { setEditMode(true); setFormData(item); setShowModal(true); }
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">{editMode ? 'Editar' : 'Criar'} Registro</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold leading-none">&times;</button>
            </div>
            <div className="p-8">
              {renderFormFields()}
            </div>
            <div className="p-6 border-t flex justify-end gap-3 bg-slate-50/50">
              <button onClick={() => setShowModal(false)} className="px-5 py-2 text-slate-500 font-bold text-sm hover:text-slate-700">Cancelar</button>
              <button onClick={handleSave} className="px-8 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all text-sm">
                Confirmar Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityListView;
