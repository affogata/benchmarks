import type { Dataset } from '@/domain/benchmarks/models'
import type { RequestOptions } from '@/shared/api'
import { ApiResource } from './base.resource'
import { ENDPOINTS } from './endpoints'

/**
 * The whole corpus in one request. The app itself boots from the four entity resources
 * instead (see `HttpBenchmarkRepository`); this one stays because the endpoint exists and a
 * consumer that wants the corpus in a single call should not have to hand-roll the fetch.
 */
export class SnapshotResource extends ApiResource {
  protected readonly path = ENDPOINTS.snapshot

  get(options?: RequestOptions): Promise<Dataset> {
    return this.read<Dataset>('', options)
  }
}
