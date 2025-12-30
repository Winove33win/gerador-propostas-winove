import { Company, Client, Service, Optional, Term, Proposal, User } from './types';
import { apiClient } from './apiClient';

const REGISTER_INVITE_TOKEN = import.meta.env?.VITE_REGISTER_INVITE_TOKEN ?? '';

type ApiListResponse<T> = { data: T[] };
type ApiItemResponse<T> = { data: T };

const list = async <T>(path: string): Promise<T[]> => {
  const response = await apiClient.request<ApiListResponse<T>>(path);
  return response?.data || [];
};

const getItem = async <T>(path: string): Promise<T> => {
  const response = await apiClient.request<ApiItemResponse<T>>(path);
  return response.data;
};

export const api = {
  auth: {
    getCurrentUser: (): User | null => apiClient.readSession()?.user ?? null,
    login: async (email: string, password: string): Promise<User> => {
      const response = await apiClient.request<{ data: { user: User; token: string } }>(
        '/auth/login',
        {
          method: 'POST',
          body: { email, password },
          auth: false,
        }
      );
      apiClient.storeSession({ user: response.data.user, token: response.data.token });
      return response.data.user;
    },
    register: async (payload: Omit<User, 'id' | 'role'> & { role?: User['role'] }): Promise<User> => {
      const response = await apiClient.request<{ data: { user: User; token: string } }>(
        '/auth/register',
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
          auth: false,
        }
      );
      apiClient.storeSession({ user: response.data.user, token: response.data.token });
      return response.data.user;
    },
    logout: () => {
      apiClient.clearSession();
    },
  },
  companies: {
    list: () => list<Company>('/companies'),
    get: (id: string) => getItem<Company>(`/companies/${id}`),
    create: (payload: Omit<Company, 'id'>) =>
      apiClient.request<ApiItemResponse<Company>>('/companies', {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Partial<Company>) =>
      apiClient.request<ApiItemResponse<Company>>(`/companies/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    delete: (id: string) =>
      apiClient.request<void>(`/companies/${id}`, { method: 'DELETE' }),
  },
  clients: {
    list: () => list<Client>('/clients'),
    get: (id: string) => getItem<Client>(`/clients/${id}`),
    create: (payload: Omit<Client, 'id'>) =>
      apiClient.request<ApiItemResponse<Client>>('/clients', {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Partial<Client>) =>
      apiClient.request<ApiItemResponse<Client>>(`/clients/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    delete: (id: string) =>
      apiClient.request<void>(`/clients/${id}`, { method: 'DELETE' }),
  },
  services: {
    list: () => list<Service>('/services'),
    get: (id: string) => getItem<Service>(`/services/${id}`),
    create: (payload: Omit<Service, 'id'>) =>
      apiClient.request<ApiItemResponse<Service>>('/services', {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Partial<Service>) =>
      apiClient.request<ApiItemResponse<Service>>(`/services/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    delete: (id: string) =>
      apiClient.request<void>(`/services/${id}`, { method: 'DELETE' }),
  },
  optionals: {
    list: () => list<Optional>('/optionals'),
    get: (id: string) => getItem<Optional>(`/optionals/${id}`),
    create: (payload: Omit<Optional, 'id'>) =>
      apiClient.request<ApiItemResponse<Optional>>('/optionals', {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Partial<Optional>) =>
      apiClient.request<ApiItemResponse<Optional>>(`/optionals/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    delete: (id: string) =>
      apiClient.request<void>(`/optionals/${id}`, { method: 'DELETE' }),
  },
  terms: {
    list: () => list<Term>('/terms'),
    get: (id: string) => getItem<Term>(`/terms/${id}`),
    create: (payload: Omit<Term, 'id'>) =>
      apiClient.request<ApiItemResponse<Term>>('/terms', {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Partial<Term>) =>
      apiClient.request<ApiItemResponse<Term>>(`/terms/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    delete: (id: string) =>
      apiClient.request<void>(`/terms/${id}`, { method: 'DELETE' }),
  },
  proposals: {
    list: () => list<Proposal>('/proposals'),
    get: (id: string) => getItem<Proposal>(`/proposals/${id}`),
    create: (payload: Omit<Proposal, 'id' | 'number'>) =>
      apiClient.request<ApiItemResponse<{ id: string; number: string }>>('/proposals', {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Partial<Proposal>) =>
      apiClient.request<ApiItemResponse<{ id: string }>>(`/proposals/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    delete: (id: string) =>
      apiClient.request<void>(`/proposals/${id}`, { method: 'DELETE' }),
  },
  users: {
    list: () => list<User>('/users'),
    get: (id: string) => getItem<User>(`/users/${id}`),
    create: (payload: Omit<User, 'id'>) =>
      apiClient.request<ApiItemResponse<User>>('/users', {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Partial<User>) =>
      apiClient.request<ApiItemResponse<User>>(`/users/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    delete: (id: string) =>
      apiClient.request<void>(`/users/${id}`, { method: 'DELETE' }),
  },
};
