import { ENV, hasConfiguredApi } from "@/config/env";

type QueryValue = string | number | boolean | null | undefined;

const buildQuery = (params?: Record<string, QueryValue>) => {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};

const buildHeaders = (auth = false) => {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (auth && ENV.accessToken) {
    headers.set("Authorization", `Bearer ${ENV.accessToken}`);
  }
  return headers;
};

export const apiClient = {
  hasApi: hasConfiguredApi,

  async get<T>(path: string, options?: { params?: Record<string, QueryValue>; auth?: boolean }): Promise<T> {
    if (!hasConfiguredApi) {
      throw new Error("API base is not configured.");
    }

    const response = await fetch(`${ENV.apiBase}/api/v1${path}${buildQuery(options?.params)}`, {
      method: "GET",
      headers: buildHeaders(options?.auth),
      signal: AbortSignal.timeout(ENV.requestTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  },

  async post<T>(path: string, body?: unknown, options?: { auth?: boolean }): Promise<T> {
    if (!hasConfiguredApi) {
      throw new Error("API base is not configured.");
    }

    const response = await fetch(`${ENV.apiBase}/api/v1${path}`, {
      method: "POST",
      headers: buildHeaders(options?.auth),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(ENV.requestTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  },
};
