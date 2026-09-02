import type { Industry } from '@/domain/benchmarks/models'
import type { RequestOptions } from '@/shared/api'
import { ApiResource } from './base.resource'
import { ENDPOINTS } from './endpoints'

export class IndustriesResource extends ApiResource {
  protected readonly path = ENDPOINTS.industries

  list(options?: RequestOptions): Promise<Industry[]> {
    return this.read<Industry[]>('', options)
  }
}
