import type { DatasetMeta } from '@/domain/benchmarks/models'
import type { RequestOptions } from '@/shared/api'
import { ApiResource } from './base.resource'
import { ENDPOINTS } from './endpoints'

/** Report week, cadence, scale and score bands — everything but the rows. */
export class MetaResource extends ApiResource {
  protected readonly path = ENDPOINTS.meta

  get(options?: RequestOptions): Promise<DatasetMeta> {
    return this.read<DatasetMeta>('', options)
  }
}
