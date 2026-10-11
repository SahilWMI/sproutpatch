export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** window.fetch must be called unbound-safe; wrapping avoids "Illegal invocation". */
export const defaultFetch: FetchLike = (input, init) => fetch(input, init);

export function trimSlash(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** True for same-origin paths and loopback hosts. Anything else means the note leaves this machine. */
export function isLocalUrl(url: string): boolean {
  const value = url.trim();
  if (value === '' || (value.startsWith('/') && !value.startsWith('//'))) return true;
  try {
    const { hostname } = new URL(value);
    const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host === '0.0.0.0' || /^127\./.test(host);
  } catch {
    return false;
  }
}

export async function readError(res: Response): Promise<string> {
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 200);
  } catch {
    // ignore
  }
  return `HTTP ${res.status}${detail ? `: ${detail}` : ''}`;
}
