import { Agent, fetch as undiciFetch } from 'undici';

// Create a global agent with keep-alive to prevent connection churn and ECONNRESET
const globalAgent = new Agent({
  keepAliveTimeout: 4000,
  keepAliveMaxTimeout: 10000,
  connections: 100, // Connection pool size
});

const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 500;
const DEFAULT_TIMEOUT_MS = 60000;

// Node.js and Undici transient error codes
const TRANSIENT_ERRORS = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
];

const TRANSIENT_STATUS_CODES = [429, 500, 502, 503, 504];

/**
 * A wrapper around undici.fetch that provides:
 * 1. Connection keep-alive (via undici.Agent)
 * 2. Exponential backoff for transient errors
 * 3. Respect for Retry-After header
 * 4. Overall request timeout (if not provided by caller)
 */
export async function fetchWithRetry(
  input: string | URL | globalThis.Request,
  init?: RequestInit
): Promise<Response> {
  let attempt = 0;

  let requestUrl = 'unknown';
  if (typeof input === 'string') requestUrl = input;
  else if (input instanceof URL) requestUrl = input.toString();
  else if (input && typeof (input as globalThis.Request).url === 'string') requestUrl = (input as globalThis.Request).url;

  while (attempt <= MAX_RETRIES) {
    let controller: AbortController | undefined;
    let timeoutId: NodeJS.Timeout | undefined;

    // If caller didn't provide a signal, we apply a default overarching timeout for the request
    const signal = init?.signal;
    let activeSignal = signal;

    if (!signal) {
      controller = new AbortController();
      activeSignal = controller.signal;
      timeoutId = setTimeout(() => controller?.abort(), DEFAULT_TIMEOUT_MS);
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await undiciFetch(input as any, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(init as any),
        dispatcher: globalAgent,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signal: activeSignal as any,
      });

      // Clear timeout on success
      if (timeoutId) clearTimeout(timeoutId);

      // If successful or it's a non-transient error, return the response.
      if (response.ok || !TRANSIENT_STATUS_CODES.includes(response.status)) {
        return response as unknown as Response; // Cast back to standard Response
      }

      // Handle specific transient status codes
      if (attempt < MAX_RETRIES) {
        let backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 500; // jitter

        // Respect Retry-After
        const retryAfter = response.headers.get('retry-after');
        if (retryAfter) {
          const parsed = parseInt(retryAfter, 10);
          if (!isNaN(parsed)) {
            backoffMs = parsed * 1000;
          } else {
            // It might be an HTTP date, parse it
            const date = new Date(retryAfter).getTime();
            if (!isNaN(date)) {
              backoffMs = Math.max(0, date - Date.now());
            }
          }
        } else if (response.status === 429 && requestUrl.includes('generativelanguage.googleapis.com')) {
          // Gemini API often puts retry delay in the JSON body, not in the Retry-After header.
          // The free tier quota window is typically up to 60s, so we'll enforce a larger backoff for 429s
          // to ensure we wait long enough without having to clone and parse the response body.
          // Wait 30s for the first retry, then 40s, etc.
          backoffMs = 30000 + (attempt * 10000) + (Math.random() * 1000);
        }

        console.warn(`[Network] HTTP ${response.status} for ${requestUrl}. Retrying in ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        attempt++;
        continue;
      }

      // If we exhausted retries, just return the response to let caller handle it.
      return response as unknown as Response;

    } catch (error: unknown) {
      if (timeoutId) clearTimeout(timeoutId);
      
      const err = error as Error & { code?: string; cause?: { code?: string } };

      const isAbortError = err.name === 'AbortError' || err.message?.includes('aborted');
      
      // If it's the caller's abort, rethrow immediately
      if (isAbortError && signal?.aborted) {
        throw err;
      }

      // Check if it's a transient network error
      const errorCode = err.code || err.cause?.code;
      const isTransientError = TRANSIENT_ERRORS.includes(errorCode || '') || 
                               err.message?.includes('fetch failed') ||
                               isAbortError; // Our own timeout might abort it, treat as transient timeout

      if (isTransientError && attempt < MAX_RETRIES) {
        const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 500; // jitter
        console.warn(`[Network] Transient error (${errorCode || err.message}) for ${requestUrl}. Retrying in ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        attempt++;
        continue;
      }

      // Exhausted retries or non-transient error, throw
      throw err;
    }
  }

  throw new Error(`Exhausted retries for ${requestUrl}`);
}

let networkInitialized = false;

/**
 * Overrides the global fetch with the resilient fetchWithRetry.
 * Call this in the server entry point.
 */
export function initNetwork() {
  if (typeof window !== 'undefined') return; // Server only
  if (networkInitialized) return;
  
  const originalFetch = globalThis.fetch;
  
  globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    // If the request is for the Next.js internal router or localhost, don't use the resilient layer
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : (input && (input as globalThis.Request).url));
    if (url && (url.includes('localhost') || url.includes('127.0.0.1'))) {
      return originalFetch(input, init);
    }
    return fetchWithRetry(input, init);
  } as typeof globalThis.fetch;
  
  networkInitialized = true;
  console.log('[Network] Centralized resilient fetch initialized.');
}
