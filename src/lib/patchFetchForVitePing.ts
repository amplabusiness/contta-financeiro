import { customFetch } from "./customFetch";

const VITE_PING_HEADER_VALUE = "text/x-vite-ping";
const FETCH_PATCH_FLAG = "__vitePingFetchPatched__";

const normalize = (value: string) => value.toLowerCase();

const getHeaderFromInit = (headers?: HeadersInit, target?: string): string | null => {
  if (!headers || !target) {
    return null;
  }

  const normalizedTarget = normalize(target);

  if (headers instanceof Headers) {
    return headers.get(normalizedTarget);
  }

  if (Array.isArray(headers)) {
    for (const [name, value] of headers) {
      if (name && normalize(name) === normalizedTarget) {
        return value ?? null;
      }
    }
    return null;
  }

  if (typeof headers === "object") {
    for (const [name, value] of Object.entries(headers)) {
      if (normalize(name) === normalizedTarget) {
        return value as string;
      }
    }
  }

  return null;
};

const getAcceptHeader = (input: RequestInfo | URL, init?: RequestInit): string | null => {
  const fromInit = getHeaderFromInit(init?.headers, "accept");
  if (fromInit) {
    return fromInit;
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.headers.get("accept");
  }

  return null;
};

const shouldUseCustomFetch = (input: RequestInfo | URL, init?: RequestInit): boolean => {
  const acceptHeader = getAcceptHeader(input, init);
  if (!acceptHeader) {
    return false;
  }

  return acceptHeader.toLowerCase().includes(VITE_PING_HEADER_VALUE);
};

const installFetchPatch = () => {
  if (typeof window === "undefined" || typeof window.fetch !== "function") {
    return;
  }

  if ((window as typeof window & Record<string, unknown>)[FETCH_PATCH_FLAG]) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  const patchedFetch: typeof fetch = (input, init) => {
    if (shouldUseCustomFetch(input, init)) {
      return customFetch(input as RequestInfo, init);
    }

    return originalFetch(input as RequestInfo, init);
  };

  window.fetch = patchedFetch;
  globalThis.fetch = patchedFetch;
  (window as typeof window & Record<string, unknown>)[FETCH_PATCH_FLAG] = true;
};

installFetchPatch();
