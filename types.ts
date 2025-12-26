
export interface User {
  id: string;
  name: string;
  email: string;
  cnpj_access: string; 
  password: string; // Novo campo para senha dedicada
  role: 'admin' | 'employee';
}

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  address: string;
  email: string;
  phone: string;
  bank_info?: string;
}

export interface Client {
  id: string;
  name: string;
  document: string;
  address: string;
  contact_person: string;
  person_name: string;
  job_title: string;
  email: string;
  phone: string;
}

export interface Service {
  id: string;
  description: string;
  detailed_description?: string;
  benefits?: string[];
  value: number;
  unit: 'hora' | 'fixo' | 'mensal' | 'projeto' | 'anual';
}

export interface Optional {
  id: string;
  description: string;
  value: number;
}

export interface Term {
  id: string;
  title: string;
  content: string;
}

export interface Proposal {
  id: string;
  number: string;
  company_id: string;
  client_id: string;
  status: 'rascunho' | 'enviada' | 'aceita' | 'recusada';
  created_at: string;
  expiry_date: string;
  deadline: string;
  portfolio_url?: string;
  domain?: string;
  platform?: string;
  services_ids: string[];
  optionals_ids: string[];
  terms_ids: string[];
  discount: number;
  total_value: number;
  notes?: string;
}

export type EntityType = 'company' | 'client' | 'service' | 'optional' | 'term' | 'proposal' | 'user';
