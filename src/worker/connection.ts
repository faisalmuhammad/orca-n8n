export class LauncherError extends Error {
  constructor(message: string, public code = 'action_failed') { super(message); }
}
export function instanceUrl(value: unknown, kind: 'local' | 'cloud'): URL {
  if (kind === 'local') return localUrl(value);
  if (kind !== 'cloud' || typeof value !== 'string' || value.length > 2048) throw new LauncherError('Choose Local or n8n Cloud and enter an instance URL.', 'invalid_params');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new LauncherError('Enter your full n8n Cloud URL.', 'invalid_params'); }
  if (url.protocol !== 'https:' || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.n8n\.cloud$/.test(url.hostname) || (url.port && url.port !== '443') || url.username || url.password || url.search || url.hash) throw new LauncherError('Use your HTTPS n8n Cloud address, such as https://your-team.app.n8n.cloud, without credentials or URL parameters.', 'invalid_params');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}
export function localUrl(value: unknown): URL {
  if (typeof value !== 'string' || value.length > 2048) throw new LauncherError('Enter a local n8n URL.', 'invalid_params');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new LauncherError('Enter a full URL, such as http://localhost:5678.', 'invalid_params'); }
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash) {
    throw new LauncherError('Use localhost, 127.0.0.1, or [::1] with HTTP or HTTPS, without credentials, a query, or a fragment.', 'invalid_params');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}
export async function checkConnection(value: string, signal: AbortSignal, transport: typeof fetch = fetch): Promise<void> {
  const base = localUrl(value);
  const endpoint = new URL('healthz', base);
  if (endpoint.hostname === 'localhost') endpoint.hostname = '127.0.0.1';
  let response: Response;
  try {
    response = await transport(endpoint, { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]), redirect: 'error', credentials: 'omit', cache: 'no-store' });
  } catch {
    if (signal.aborted) throw new LauncherError('Connection check cancelled.', 'cancelled');
    throw new LauncherError('Could not reach n8n at ' + base.host + '. Start the instance and check the port, then try again.', 'unavailable');
  }
  if (!response.ok) { await response.body?.cancel(); throw new LauncherError('n8n is not ready (HTTP ' + response.status + '). Wait for it to start, then check again.', 'unavailable'); }
  const reader = response.body?.getReader();
  let text = '';
  let size = 0;
  try {
    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        size += chunk.byteLength;
        if (size > 1024) throw new LauncherError('This URL did not return an n8n health response.', 'unavailable');
        text += decoder.decode(chunk, { stream: true });
      }
      text += decoder.decode();
    }
    let data: unknown;
    try { data = JSON.parse(text); } catch { /* Reject unrelated local servers. */ }
    if (!data || typeof data !== 'object' || !('status' in data) || data.status !== 'ok') throw new LauncherError('This URL did not return an n8n health response. Check the instance URL.', 'unavailable');
  } finally { await reader?.cancel().catch(() => undefined); }
}
