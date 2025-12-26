
import { Company, Client, Service, Optional, Term, Proposal, User } from './types';

const STORAGE_KEYS = {
  COMPANIES: 'prop_companies',
  CLIENTS: 'prop_clients',
  SERVICES: 'prop_services',
  OPTIONALS: 'prop_optionals',
  TERMS: 'prop_terms',
  PROPOSALS: 'prop_proposals',
  USERS: 'prop_users',
  SESSION: 'prop_session'
};

const API_BASE = '/api';

const isBrowser = typeof window !== 'undefined';

const safeFetch = async (url: string, options?: RequestInit) => {
  if (!isBrowser) return;
  try {
    await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      },
      ...options
    });
  } catch (error) {
    console.warn('Falha ao sincronizar com a API:', error);
  }
};

const get = <T,>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const save = <T,>(key: string, data: T[]): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

const seed = () => {
  // Seed de Usuários
  if (get(STORAGE_KEYS.USERS).length === 0) {
    save(STORAGE_KEYS.USERS, [{
      id: 'admin-1',
      name: 'Fernando Winove',
      email: 'contato@winove.com.br',
      cnpj_access: '29.900.423/0001-40',
      password: 'admin', // Senha padrão para o primeiro acesso
      role: 'admin'
    }]);
  }

  if (get(STORAGE_KEYS.COMPANIES).length === 0) {
    save(STORAGE_KEYS.COMPANIES, [{
      id: '1', 
      name: 'Winove Online', 
      cnpj: '29.900.423/0001-40',
      address: 'Escritório Digital', 
      email: 'contato@winove.com.br', 
      phone: '(11) 99999-9999',
      bank_info: 'PIX CNPJ: 29900423000140 | Banco Caixa'
    }]);
  }
  
  if (get(STORAGE_KEYS.SERVICES).length === 0) {
    save(STORAGE_KEYS.SERVICES, [
      { id: '1', description: 'Construção em Wix Studio', value: 2300, unit: 'projeto', benefits: ['Sites responsivos', 'SEO Otimizado'] },
      { id: '2', description: 'SEO Avançado', value: 800, unit: 'fixo' }
    ]);
  }
  if (get(STORAGE_KEYS.TERMS).length === 0) {
    save(STORAGE_KEYS.TERMS, [
      { id: '1', title: 'Objeto da Proposta', content: 'Prestação de serviços digitais conforme escopo.' },
      { id: '2', title: 'Aceite', content: 'Aprovação implica aceite dos termos.' }
    ]);
  }
};

seed();

export const db = {
  auth: {
    login: (email: string, cnpj: string, password: string): User | null => {
      const users = get<User>(STORAGE_KEYS.USERS);
      const user = users.find(u => 
        u.email.toLowerCase() === email.toLowerCase() && 
        u.cnpj_access.replace(/\D/g, '') === cnpj.replace(/\D/g, '') &&
        u.password === password
      );
      if (user) {
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
        return user;
      }
      return null;
    },
    logout: () => localStorage.removeItem(STORAGE_KEYS.SESSION),
    getCurrentUser: (): User | null => {
      const data = localStorage.getItem(STORAGE_KEYS.SESSION);
      return data ? JSON.parse(data) : null;
    }
  },
  users: {
    list: () => get<User>(STORAGE_KEYS.USERS),
    create: (data: Omit<User, 'id'>) => {
      const items = get<User>(STORAGE_KEYS.USERS);
      const newItem = { ...data, id: crypto.randomUUID() };
      save(STORAGE_KEYS.USERS, [...items, newItem]);
      void safeFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return newItem;
    },
    update: (id: string, data: Partial<User>) => {
      const items = get<User>(STORAGE_KEYS.USERS);
      const updated = items.map(i => i.id === id ? { ...i, ...data } : i);
      save(STORAGE_KEYS.USERS, updated);
    },
    delete: (id: string) => {
      save(STORAGE_KEYS.USERS, get<User>(STORAGE_KEYS.USERS).filter(i => i.id !== id));
    }
  },
  companies: {
    list: () => get<Company>(STORAGE_KEYS.COMPANIES),
    get: (id: string) => get<Company>(STORAGE_KEYS.COMPANIES).find(i => i.id === id),
    create: (data: Omit<Company, 'id'>) => {
      const items = get<Company>(STORAGE_KEYS.COMPANIES);
      const newItem = { ...data, id: crypto.randomUUID() };
      save(STORAGE_KEYS.COMPANIES, [...items, newItem]);
      return newItem;
    },
    update: (id: string, data: Partial<Company>) => {
      const items = get<Company>(STORAGE_KEYS.COMPANIES);
      const updated = items.map(i => i.id === id ? { ...i, ...data } : i);
      save(STORAGE_KEYS.COMPANIES, updated);
    },
    delete: (id: string) => {
      save(STORAGE_KEYS.COMPANIES, get<Company>(STORAGE_KEYS.COMPANIES).filter(i => i.id !== id));
    }
  },
  clients: {
    list: () => get<Client>(STORAGE_KEYS.CLIENTS),
    get: (id: string) => get<Client>(STORAGE_KEYS.CLIENTS).find(i => i.id === id),
    create: (data: Omit<Client, 'id'>) => {
      const items = get<Client>(STORAGE_KEYS.CLIENTS);
      const newItem = { ...data, id: crypto.randomUUID() };
      save(STORAGE_KEYS.CLIENTS, [...items, newItem]);
      void safeFetch(`${API_BASE}/clients`, {
        method: 'POST',
        body: JSON.stringify(newItem)
      });
      return newItem;
    },
    update: (id: string, data: Partial<Client>) => {
      const items = get<Client>(STORAGE_KEYS.CLIENTS);
      const updated = items.map(i => i.id === id ? { ...i, ...data } : i);
      save(STORAGE_KEYS.CLIENTS, updated);
      void safeFetch(`${API_BASE}/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...updated.find(i => i.id === id), ...data })
      });
    },
    delete: (id: string) => {
      save(STORAGE_KEYS.CLIENTS, get<Client>(STORAGE_KEYS.CLIENTS).filter(i => i.id !== id));
      void safeFetch(`${API_BASE}/clients/${id}`, { method: 'DELETE' });
    }
  },
  services: {
    list: () => get<Service>(STORAGE_KEYS.SERVICES),
    create: (data: Omit<Service, 'id'>) => {
      const items = get<Service>(STORAGE_KEYS.SERVICES);
      const newItem = { ...data, id: crypto.randomUUID() };
      save(STORAGE_KEYS.SERVICES, [...items, newItem]);
      return newItem;
    },
    update: (id: string, data: Partial<Service>) => {
      const items = get<Service>(STORAGE_KEYS.SERVICES);
      const updated = items.map(i => i.id === id ? { ...i, ...data } : i);
      save(STORAGE_KEYS.SERVICES, updated);
    },
    delete: (id: string) => {
      save(STORAGE_KEYS.SERVICES, get<Service>(STORAGE_KEYS.SERVICES).filter(i => i.id !== id));
    }
  },
  optionals: {
    list: () => get<Optional>(STORAGE_KEYS.OPTIONALS),
    create: (data: Omit<Optional, 'id'>) => {
      const items = get<Optional>(STORAGE_KEYS.OPTIONALS);
      const newItem = { ...data, id: crypto.randomUUID() };
      save(STORAGE_KEYS.OPTIONALS, [...items, newItem]);
      return newItem;
    },
    update: (id: string, data: Partial<Optional>) => {
      const items = get<Optional>(STORAGE_KEYS.OPTIONALS);
      const updated = items.map(i => i.id === id ? { ...i, ...data } : i);
      save(STORAGE_KEYS.OPTIONALS, updated);
    },
    delete: (id: string) => {
      save(STORAGE_KEYS.OPTIONALS, get<Optional>(STORAGE_KEYS.OPTIONALS).filter(i => i.id !== id));
    }
  },
  terms: {
    list: () => get<Term>(STORAGE_KEYS.TERMS),
    create: (data: Omit<Term, 'id'>) => {
      const items = get<Term>(STORAGE_KEYS.TERMS);
      const newItem = { ...data, id: crypto.randomUUID() };
      save(STORAGE_KEYS.TERMS, [...items, newItem]);
      return newItem;
    },
    update: (id: string, data: Partial<Term>) => {
      const items = get<Term>(STORAGE_KEYS.TERMS);
      const updated = items.map(i => i.id === id ? { ...i, ...data } : i);
      save(STORAGE_KEYS.TERMS, updated);
    },
    delete: (id: string) => {
      save(STORAGE_KEYS.TERMS, get<Term>(STORAGE_KEYS.TERMS).filter(i => i.id !== id));
    }
  },
  proposals: {
    list: () => get<Proposal>(STORAGE_KEYS.PROPOSALS),
    get: (id: string) => get<Proposal>(STORAGE_KEYS.PROPOSALS).find(i => i.id === id),
    create: (data: Omit<Proposal, 'id' | 'number'>) => {
      const items = get<Proposal>(STORAGE_KEYS.PROPOSALS);
      const newItem = { 
        ...data, 
        id: crypto.randomUUID(),
        number: `PRP-${new Date().getFullYear()}-${items.length + 1}`
      };
      save(STORAGE_KEYS.PROPOSALS, [...items, newItem]);
      void safeFetch(`${API_BASE}/proposals`, {
        method: 'POST',
        body: JSON.stringify(newItem)
      });
      return newItem;
    },
    update: (id: string, data: Partial<Proposal>) => {
      const items = get<Proposal>(STORAGE_KEYS.PROPOSALS);
      const updated = items.map(i => i.id === id ? { ...i, ...data } : i);
      save(STORAGE_KEYS.PROPOSALS, updated);
      const payload = updated.find(i => i.id === id);
      if (payload) {
        void safeFetch(`${API_BASE}/proposals/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      }
    },
    delete: (id: string) => {
      save(STORAGE_KEYS.PROPOSALS, get<Proposal>(STORAGE_KEYS.PROPOSALS).filter(i => i.id !== id));
      void safeFetch(`${API_BASE}/proposals/${id}`, { method: 'DELETE' });
    }
  }
};
