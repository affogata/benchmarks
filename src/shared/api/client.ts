/**
 * The only place in the app that calls `fetch`. It knows two things resources should not
 * have to repeat: how the Affogata API shapes a response (`{ data }` on success, `{ error }`
 * on failure), and how a failure becomes an `ApiError`.
 */
import { apiBaseUrl } from './config'
import { ApiError } from './errors'

export type QueryValue = string | number | boolean | null | undefined

export type QueryParams = Record<string, QueryValue>

export interface RequestOptions {
  /** Null, undefined and empty-string values are dropped rather than sent as blanks. */
  query?: QueryParams
  signal?: AbortSignal
}

/** Response envelope used by `Api::V1::Public` controllers on the Rails side. */
interface Envelope<T> {
  data?: T
  error?: string
}

export class HttpClient {
  constructor(private readonly baseUrl: string = apiBaseUrl()) {}

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.query)
    const response = await this.send(url, options.signal)
    const body = await this.readEnvelope<T>(response, url)

    if (!response.ok) {
      throw new ApiError(body?.error ?? `${response.status} ${response.statusText}`, {
        url,
        status: response.status,
      })
    }

    if (!body || body.data === undefined) {
      throw new ApiError(`Response from ${url} carried no "data"`, { url, status: response.status })
    }

    return body.data
  }

  private async send(url: string, signal?: AbortSignal): Promise<Response> {
    try {
      return await fetch(url, {
        method: 'GET',
        // The public endpoints read no session; sending cookies cross-origin would only get
        // the response rejected, since the API grants CORS with `credentials: false`.
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        signal: signal ?? null,
      })
    } catch (cause) {
      // An aborted request is the caller's own doing — let it through untranslated.
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
      throw new ApiError(`Could not reach ${url}`, { url, cause })
    }
  }

  /** Returns null for an empty body, which is legal on an error response. */
  private async readEnvelope<T>(response: Response, url: string): Promise<Envelope<T> | null> {
    let text: string
    try {
      text = await response.text()
    } catch (cause) {
      throw new ApiError(`Response from ${url} was cut short`, { url, status: response.status, cause })
    }

    if (!text) return null

    try {
      return JSON.parse(text) as Envelope<T>
    } catch (cause) {
      if (!response.ok) return null
      throw new ApiError(`Response from ${url} is not JSON`, { url, status: response.status, cause })
    }
  }

  private buildUrl(path: string, query?: QueryParams): string {
    // The second argument keeps a relative `VITE_API_BASE_URL` (same-origin proxy) working.
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin)

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === null || value === undefined || value === '') continue
      url.searchParams.set(key, String(value))
    }

    return url.toString()
  }
}
