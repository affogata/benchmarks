import type { Category } from '@/domain/benchmarks/models'
import type { RequestOptions } from '@/shared/api'
import { ApiResource } from './base.resource'
import { ENDPOINTS } from './endpoints'

export interface CategoryQuery {
  industryId?: string | null
}

export class CategoriesResource extends ApiResource {
  protected readonly path = ENDPOINTS.categories

  /** An unknown `industryId` is a 404 from the API, not an empty list. */
  list(query: CategoryQuery = {}, options?: RequestOptions): Promise<Category[]> {
    return this.read<Category[]>('', { ...options, query: { industry_id: query.industryId } })
  }
}
