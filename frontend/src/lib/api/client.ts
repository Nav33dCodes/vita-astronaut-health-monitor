export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";

interface ProblemDetails {
  title?: string;
  detail?: string;
  status?: number;
  code?: string;
  errors?: Record<string, string[]>;
}

/** An RFC 9457 problem details response from the API. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, problem: ProblemDetails) {
    super(problem.detail ?? problem.title ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = problem.code;
    this.fieldErrors = problem.errors ?? {};
  }
}

type QueryValue = string | number | boolean | null | undefined;

export function withQuery(path: string, params: object = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, QueryValue>)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Accept: "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(0, { title: "Cannot reach the AstroHealth API. Is the backend running?" });
  }

  if (!response.ok) {
    const problem: ProblemDetails = await response.json().catch(() => ({}));
    throw new ApiError(response.status, problem);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => apiRequest<void>(path, { method: "DELETE" }),
};
