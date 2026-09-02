import type { HttpClient, RequestOptions } from '@/shared/api'

/**
 * One resource per entity. A resource owns its path and its query-parameter names — the
 * snake_case the Rails API expects stops here and never leaks into stores or components.
 */
export abstract class ApiResource {
  constructor(protected readonly client: HttpClient) {}

  /** Absolute path this resource is rooted at, e.g. `/api/v1/public/benchmarks/titles`. */
  protected abstract readonly path: string

  protected read<T>(suffix = '', options?: RequestOptions): Promise<T> {
    return this.client.get<T>(`${this.path}${suffix}`, options)
  }
}
