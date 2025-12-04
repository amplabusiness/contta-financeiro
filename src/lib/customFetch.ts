type SupportedRequestInfo = RequestInfo | URL;

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

export const customFetch = async (input: SupportedRequestInfo, init?: RequestInit): Promise<Response> => {
  const url = getRequestUrl(input);
  const method = getRequestMethod(input, init);
  const headers = getRequestHeaders(input, init);
  const body = await getRequestBody(input, init);

  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open(method, url, true);
    xhr.responseType = "arraybuffer";
    xhr.withCredentials = init?.credentials === "include";

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
      const responseBody = xhr.response ?? null;
      resolve(new Response(responseBody, responseInit));
    };

    xhr.onerror = () => {
      cleanup();
      reject(new TypeError("Network request failed"));
    };

    xhr.ontimeout = () => {
      cleanup();
      reject(new TypeError("Network request failed"));
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
      reject(error as Error);
    }
  });
};
