import {
  Company,
  Client,
  Service,
  Optional,
  Term,
  Proposal,
  User,
} from './types';

const API_BASE = '/api';
const SESSION_KEY = 'prop_session';
type Session = { user: User; token: string };
const REGISTER_INVITE_TOKEN = import.meta.env?.VITE_REGISTER_INVITE_TOKEN ?? '';

type ApiListResponse<T> = { data: T[] };
type ApiItemResponse<T> = { data: T };

const request = async <T>(
  path: string,
  options: RequestInit & { body?: unknown } = {}
): Promise<T> => {
  const { body, ...rest } = options;
  const session = readSession();
  const response = await fetch(path, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(rest.headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get('Content-Type') || '';
  const isJsonResponse = contentType.includes('application/json');

  if (!response.ok) {
    let message = 'Erro ao processar solicitação.';
    if (isJsonResponse) {
      try {
        const payload = await response.json();
        message = payload?.error || message;
      } catch (error) {
        // ignore JSON parse failures
      }
    } else {
      try {
        const payload = await response.text();
        message = payload || message;
      } catch (error) {
        // ignore text parse failures
      }
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!isJsonResponse) {
    const payload = await response.text();
    throw new Error(payload || 'Resposta inválida do servidor.');
  }

  return response.json();
};

const list = async <T>(path: string): Promise<T[]> => {
  const response = await request<ApiListResponse<T>>(path);
  return response?.data || [];
};

const getItem = async <T>(path: string): Promise<T> => {
  const response = await request<ApiItemResponse<T>>(path);
  return response.data;
};

const storeSession = (session: Session | null) => {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const readSession = (): Session | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
};

export const api = {
  auth: {
    getCurrentUser: (): User | null => readSession()?.user ?? null,
    login: async (email: string, cnpj: string, password: string): Promise<User> => {
      const response = await request<{ data: { user: User; token: string } }>('/auth/login', {
        method: 'POST',
        body: { email, cnpj_access: cnpj, password },
      });
      storeSession({ user: response.data.user, token: response.data.token });
      return response.data.user;
    },
    register: async (payload: Omit<User, 'id' | 'role'> & { role?: User['role'] }): Promise<User> => {
      const response = await request<{ data: { user: User; token: string } }>(
        '/api/auth/register',
        {
        method: 'POST',
        headers: REGISTER_INVITE_TOKEN ? { 'x-invite-token': REGISTER_INVITE_TOKEN } : undefined,
        body: {
          name: payload.name,
          email: payload.email,
          cnpj_access: payload.cnpj_access,
          password: payload.password,
          ...(REGISTER_INVITE_TOKEN ? { invite_token: REGISTER_INVITE_TOKEN } : {}),
        },
        }
      );
      storeSession({ user: response.data.user, token: response.data.token });
      return response.data.user;
    },
    logout: () => {
      storeSession(null);
    },
  },
  companies: {
    list: () => list<Company>(`${API_BASE}/companies`),
    get: (id: string) => getItem<Company>(`${API_BASE}/companies/${id}`),
    create: (payload: Omit<Company, 'id'>) =>
      request<ApiItemResponse<Company>>(`${API_BASE}/companies`, {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Partial<Company>) =>
      request<ApiItemResponse<Company>>(`${API_BASE}/companies/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    delete: (id: string) =>
      request<void>(`${API_BASE}/companies/${id}`, { method: 'DELETE' }),
  },
  clients: {
    list: () => list<Client>(`${API_BASE}/clients`),
    get: (id: string) => getItem<Client>(`${API_BASE}/clients/${id}`),
    create: (payload: Omit<Client, 'id'>) =>
      request<ApiItemResponse<Client>>(`${API_BASE}/clients`, {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Partial<Client>) =>
      request<ApiItemResponse<Client>>(`${API_BASE}/clients/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    delete: (id: string) =>
      request<void>(`${API_BASE}/clients/${id}`, { method: 'DELETE' }),
  },
  services: {
    list: () => list<Service>(`${API_BASE}/services`),
    get: (id: string) => getItem<Service>(`${API_BASE}/services/${id}`),
    create: (payload: Omit<Service, 'id'>) =>
      request<ApiItemResponse<Service>>(`${API_BASE}/services`, {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Partial<Service>) =>
      request<ApiItemResponse<Service>>(`${API_BASE}/services/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    delete: (id: string) =>
      request<void>(`${API_BASE}/services/${id}`, { method: 'DELETE' }),
  },
  optionals: {
    list: () => list<Optional>(`${API_BASE}/optionals`),
    get: (id: string) => getItem<Optional>(`${API_BASE}/optionals/${id}`),
    create: (payload: Omit<Optional, 'id'>) =>
      request<ApiItemResponse<Optional>>(`${API_BASE}/optionals`, {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Partial<Optional>) =>
      request<ApiItemResponse<Optional>>(`${API_BASE}/optionals/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    delete: (id: string) =>
      request<void>(`${API_BASE}/optionals/${id}`, { method: 'DELETE' }),
  },
  terms: {
    list: () => list<Term>(`${API_BASE}/terms`),
    get: (id: string) => getItem<Term>(`${API_BASE}/terms/${id}`),
    create: (payload: Omit<Term, 'id'>) =>
      request<ApiItemResponse<Term>>(`${API_BASE}/terms`, {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Partial<Term>) =>
      request<ApiItemResponse<Term>>(`${API_BASE}/terms/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    delete: (id: string) =>
      request<void>(`${API_BASE}/terms/${id}`, { method: 'DELETE' }),
  },
  proposals: {
    list: () => list<Proposal>(`${API_BASE}/proposals`),
    get: (id: string) => getItem<Proposal>(`${API_BASE}/proposals/${id}`),
    create: (payload: Omit<Proposal, 'id' | 'number'>) =>
      request<ApiItemResponse<{ id: string; number: string }>>(`${API_BASE}/proposals`, {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Partial<Proposal>) =>
      request<ApiItemResponse<{ id: string }>>(`${API_BASE}/proposals/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    delete: (id: string) =>
      request<void>(`${API_BASE}/proposals/${id}`, { method: 'DELETE' }),
  },
  users: {
    list: () => list<User>(`${API_BASE}/users`),
    get: (id: string) => getItem<User>(`${API_BASE}/users/${id}`),
    create: (payload: Omit<User, 'id'>) =>
      request<ApiItemResponse<User>>(`${API_BASE}/users`, {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Partial<User>) =>
      request<ApiItemResponse<User>>(`${API_BASE}/users/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    delete: (id: string) =>
      request<void>(`${API_BASE}/users/${id}`, { method: 'DELETE' }),
  },
};
