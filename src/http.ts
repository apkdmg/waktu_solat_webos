/** Minimal `fetch` signature the client needs; any WHATWG-compatible `fetch` works. */
export type FetchLike = (url: string) => Promise<{ status: number; text(): Promise<string> }>;

export interface HttpResponse {
  status: number;
  body: string;
}

/**
 * Performs a GET request with `fetch`, or with `XMLHttpRequest` on older
 * Tizen TVs (2.4 and earlier) that don't have `fetch`.
 */
export function httpGet(url: string, timeoutMs: number, fetchImpl?: FetchLike): Promise<HttpResponse> {
  const doFetch: FetchLike | undefined =
    fetchImpl || (typeof fetch === 'function' ? (u: string) => fetch(u) : undefined);

  if (!doFetch) return xhrGet(url, timeoutMs);

  return withTimeout(
    doFetch(url).then((response) =>
      response.text().then((body) => ({ status: response.status, body: body }))
    ),
    timeoutMs
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out after ' + timeoutMs + 'ms')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function xhrGet(url: string, timeoutMs: number): Promise<HttpResponse> {
  return new Promise<HttpResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    if (timeoutMs > 0) xhr.timeout = timeoutMs;
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new Error('XMLHttpRequest failed'));
    xhr.ontimeout = () => reject(new Error('Request timed out after ' + timeoutMs + 'ms'));
    xhr.send();
  });
}
