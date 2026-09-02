export interface ApiErrorOptions extends ErrorOptions {
  url: string
  /** HTTP status, or omitted when the request never produced a response. */
  status?: number | null
}

/**
 * Every failure the resources layer can produce, in one type. Callers that only want to
 * show a message read `.message`; callers that branch on the outcome read `.status`.
 */
export class ApiError extends Error {
  readonly url: string

  /** HTTP status, or `null` when the request never reached the server. */
  readonly status: number | null

  constructor(message: string, options: ApiErrorOptions) {
    super(message, { cause: options.cause })
    this.name = 'ApiError'
    this.url = options.url
    this.status = options.status ?? null
  }

  /** True when nothing came back — offline, DNS, CORS rejection, connection reset. */
  get isNetworkError(): boolean {
    return this.status === null
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}

export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError
