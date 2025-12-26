
import React, { useMemo, useEffect, useState } from 'react';
import { api } from '../api';
// Fixed: Added missing PlusCircle import
import { TrendingUp, Users, Files, CheckCircle2, Clock, PlusCircle } from 'lucide-react';
import { Client, Proposal } from '../types';

interface Props {
  navigateTo: (view: any) => void;
}

const DashboardView: React.FC<Props> = ({ navigateTo }) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [proposalsResponse, clientsResponse] = await Promise.all([
          api.proposals.list(),
          api.clients.list(),
        ]);
        setProposals(proposalsResponse);
        setClients(clientsResponse);
      } catch (error) {
        console.warn('Falha ao carregar dados do dashboard.', error);
      }
    };

    void loadData();
  }, []);
  
  const stats = useMemo(() => {
    const totalValue = proposals.reduce((acc, curr) => acc + curr.total_value, 0);
    const acceptedCount = proposals.filter(p => p.status === 'aceita').length;
    const pendingCount = proposals.filter(p => p.status === 'enviada').length;
    
    return [
      { label: 'Valor Total Propostas', value: `R$ ${totalValue.toLocaleString('pt-BR')}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
      { label: 'Clientes Ativos', value: clients.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
      { label: 'Propostas Aceitas', value: acceptedCount, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { label: 'Aguardando Resposta', value: pendingCount, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    ];
  }, [proposals, clients]);

  const recentProposals = proposals.slice(-5).reverse();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Bem-vindo ao Propulsão</h2>
        <p className="text-slate-500">Tenha uma visão geral das suas propostas e desempenho comercial.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Proposals */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2">
              <Files size={18} className="text-slate-400" />
              Propostas Recentes
            </h3>
            <button 
              onClick={() => navigateTo('proposals')}
              className="text-sm text-blue-600 font-semibold hover:underline"
            >
              Ver todas
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {recentProposals.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                Nenhuma proposta cadastrada ainda.
              </div>
            ) : (
              recentProposals.map(proposal => {
                const client = clients.find(c => c.id === proposal.client_id);
                return (
                  <div key={proposal.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex gap-4 items-center">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500">
                        {client?.name?.substring(0, 1) || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{client?.name || 'Cliente Removido'}</p>
                        <p className="text-xs text-slate-500">{proposal.number} • {new Date(proposal.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">R$ {proposal.total_value.toLocaleString('pt-BR')}</p>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        proposal.status === 'aceita' ? 'bg-emerald-100 text-emerald-700' :
                        proposal.status === 'recusada' ? 'bg-rose-100 text-rose-700' :
                        proposal.status === 'enviada' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {proposal.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-8 text-white flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">Pronto para crescer?</h3>
            <p className="text-blue-100 text-sm mb-6">Crie uma nova proposta comercial em minutos utilizando seus itens pré-cadastrados.</p>
          </div>
          <button 
            onClick={() => navigateTo('new-proposal')}
            className="w-full bg-white text-blue-700 font-bold py-4 rounded-xl shadow-lg hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
          >
            <PlusCircle size={20} />
            Criar Proposta Agora
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
