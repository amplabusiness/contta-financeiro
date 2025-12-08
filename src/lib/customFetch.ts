export type SupportedRequestInfo = RequestInfo | URL;

const getRequestUrl = (input: SupportedRequestInfo): string => {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.url;
  }
  throw new TypeError("Unsupported request input provided to customFetch");
};

const getRequestMethod = (input: SupportedRequestInfo, init?: RequestInit): string => {
  if (init?.method) {
    return init.method;
  }
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method || "GET";
  }
  return "GET";
};

const getRequestHeaders = (input: SupportedRequestInfo, init?: RequestInit): Headers => {
  const headers = new Headers();

  const appendFrom = (source?: HeadersInit) => {
    if (!source) return;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  };

  if (typeof Request !== "undefined" && input instanceof Request) {
    appendFrom(input.headers);
  }

  appendFrom(init?.headers);

  return headers;
};

const getRequestBody = async (input: SupportedRequestInfo, init?: RequestInit): Promise<BodyInit | null | undefined> => {
  if (init && init.body !== undefined) {
    return init.body as BodyInit;
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    if (input.bodyUsed) {
      return undefined;
    }
    const cloned = input.clone();
    try {
      return await cloned.arrayBuffer();
    } catch {
      return undefined;
    }
  }

  return undefined;
};

const getRequestCredentials = (input: SupportedRequestInfo, init?: RequestInit): RequestCredentials | undefined => {
  if (init?.credentials) {
    return init.credentials;
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.credentials;
  }

  return undefined;
};

const isSameOriginRequest = (url: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const resolvedUrl = new URL(url, window.location.href);
    return resolvedUrl.origin === window.location.origin;
  } catch {
    return false;
  }
};

const shouldIncludeCredentials = (url: string, credentials?: RequestCredentials): boolean => {
  if (!credentials) {
    return false;
  }

  if (credentials === "include") {
    return true;
  }

  if (credentials === "same-origin") {
    return isSameOriginRequest(url);
  }

  return false;
};

const buildResponseHeaders = (rawHeaders: string): Headers => {
  const headers = new Headers();
  rawHeaders.trim().split(/\r?\n/).forEach((line) => {
    if (!line) return;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) return;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    headers.append(key, value);
  });
  return headers;
};

const shouldUseNullBody = (status: number): boolean => {
  switch (status) {
    case 101:
    case 204:
    case 205:
    case 304:
      return true;
    default:
      return false;
  }
};

export const customFetch = async (input: SupportedRequestInfo, init?: RequestInit): Promise<Response> => {
  if (typeof XMLHttpRequest === "undefined") {
    if (typeof fetch !== "function") {
      throw new Error("No fetch or XMLHttpRequest implementation available in this environment");
    }
    return fetch(input as RequestInfo, init);
  }

  const url = getRequestUrl(input);
  const method = getRequestMethod(input, init);
  const headers = getRequestHeaders(input, init);
  const body = await getRequestBody(input, init);
  const credentials = getRequestCredentials(input, init);
  const sendCredentials = shouldIncludeCredentials(url, credentials);

  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open(method, url, true);
    xhr.responseType = "arraybuffer";
    xhr.withCredentials = sendCredentials;
    xhr.timeout = 30000;

    headers.forEach((value, key) => {
      xhr.setRequestHeader(key, value);
    });

    const cleanup = () => {
      if (init?.signal) {
        init.signal.removeEventListener("abort", abortHandler);
      }
    };

    const abortHandler = () => {
      xhr.abort();
      cleanup();
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };

    if (init?.signal) {
      if (init.signal.aborted) {
        return abortHandler();
      }
      init.signal.addEventListener("abort", abortHandler, { once: true });
    }

    xhr.onload = () => {
      cleanup();
      const responseHeaders = buildResponseHeaders(xhr.getAllResponseHeaders());
      const responseInit: ResponseInit = {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: responseHeaders,
      };
      const responseBody = shouldUseNullBody(xhr.status) ? null : xhr.response ?? null;
      resolve(new Response(responseBody, responseInit));
    };

    xhr.onerror = () => {
      cleanup();
      const error = new TypeError("Network request failed");
      (error as any).cause = "xhr_network_error";
      (error as any).url = url;
      (error as any).method = method;
      console.error("[customFetch] Network error:", {
        url,
        method,
        readyState: xhr.readyState,
        status: xhr.status,
        statusText: xhr.statusText,
      });
      reject(error);
    };

    xhr.ontimeout = () => {
      cleanup();
      const error = new TypeError("Network request timeout");
      (error as any).cause = "xhr_timeout";
      (error as any).url = url;
      console.error("[customFetch] Request timeout:", { url, method });
      reject(error);
    };

    try {
      if (body === undefined) {
        xhr.send();
      } else if (body === null) {
        xhr.send(null);
      } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
        xhr.send(body as ArrayBufferView);
      } else {
        xhr.send(body as Document | BodyInit);
      }
    } catch (error) {
      cleanup();
      const sendError = error instanceof Error ? error : new Error(String(error));
      (sendError as any).cause = "xhr_send_error";
      (sendError as any).url = url;
      console.error("[customFetch] Send error:", { url, method, originalError: error });
      reject(sendError);
    }
  });
};
