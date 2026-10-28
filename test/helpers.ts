import { FetchLike } from '../src/http.js';

export interface MockFetch extends FetchLike {
  urls: string[];
}

type Reply = { status?: number; body: string } | Error;

/** A fetch stand-in that answers each call with the next reply and records the URLs. */
export function mockFetch(...replies: Reply[]): MockFetch {
  const urls: string[] = [];
  const fn = ((url: string) => {
    urls.push(url);
    const reply = replies.shift();
    if (!reply) return Promise.reject(new Error('No mock reply for ' + url));
    if (reply instanceof Error) return Promise.reject(reply);
    return Promise.resolve({
      status: reply.status ?? 200,
      text: () => Promise.resolve(reply.body),
    });
  }) as MockFetch;
  fn.urls = urls;
  return fn;
}

export const BASE = 'https://api.test';
