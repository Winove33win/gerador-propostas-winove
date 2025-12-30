import { User } from './types';

const API_BASE = import.meta.env?.VITE_API_BASE || '/api';
const SESSION_KEY = 'prop_session';

type Session = { user: User; token: string };
type ApiRequestOptions = RequestInit & { body?: unknown; auth?: boolean };

const buildUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith(API_BASE)) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
};

const readSession = (): Session | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
};

const storeSession = (session: Session | null) => {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const clearSession = () => storeSession(null);

const buildHeaders = (options: ApiRequestOptions, token?: string) => {
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const body = options.body;
  const isJsonBody = body !== undefined && !(body instanceof FormData);
  if (isJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
};

const parseErrorMessage = async (response: Response) => {
  const contentType = response.headers.get('Content-Type') || '';
  const isJsonResponse = contentType.includes('application/json');

  if (isJsonResponse) {
    try {
      const payload = await response.json();
      return payload?.error || payload?.message || 'Erro ao processar solicitação.';
    } catch {
      return 'Erro ao processar solicitação.';
    }
  }

  try {
    const payload = await response.text();
    return payload || 'Erro ao processar solicitação.';
  } catch {
    return 'Erro ao processar solicitação.';
  }
};

const request = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const { body, auth = true, ...rest } = options;
  const session = readSession();
  const token = auth ? session?.token : undefined;
  const response = await fetch(buildUrl(path), {
    ...rest,
    headers: buildHeaders({ ...options, body }, token),
    body: body !== undefined && !(body instanceof FormData) ? JSON.stringify(body) : (body as BodyInit),
  });

  if (!response.ok) {
    if (auth && (response.status === 401 || response.status === 403)) {
      clearSession();
    }
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('Content-Type') || '';
  const isJsonResponse = contentType.includes('application/json');
  if (!isJsonResponse) {
    const payload = await response.text();
    throw new Error(payload || 'Resposta inválida do servidor.');
  }

  return response.json();
};

export const apiClient = {
  request,
  readSession,
  storeSession,
  clearSession,
};
