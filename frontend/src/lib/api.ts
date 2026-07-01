export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface AuthUser {
  id: string;
  username: string;
}

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

interface ErrorResponse {
  message?: string | string[];
}

async function postAuth(path: string, body: unknown): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data: unknown = await res.json();
  if (!res.ok) {
    const { message } = (data ?? {}) as ErrorResponse;
    const text = Array.isArray(message) ? message[0] : message;
    throw new Error(text ?? "요청에 실패했어요.");
  }
  return data as AuthResponse;
}

export const authApi = {
  register: (username: string, password: string) => postAuth("/auth/register", { username, password }),
  login: (username: string, password: string) => postAuth("/auth/login", { username, password }),
};
