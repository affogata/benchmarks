import type { Title } from '@/domain/benchmarks/models'
import type { RequestOptions } from '@/shared/api'
import { ApiResource } from './base.resource'
import { ENDPOINTS } from './endpoints'

export interface TitleQuery {
  categoryId?: string | null
  industryId?: string | null
}

export class TitlesResource extends ApiResource {
  protected readonly path = ENDPOINTS.titles

  /** Both filters are optional and combine. Unknown ids are a 404, not an empty list. */
  list(query: TitleQuery = {}, options?: RequestOptions): Promise<Title[]> {
    return this.read<Title[]>('', {
      ...options,
      query: { category_id: query.categoryId, industry_id: query.industryId },
    })
  }

  find(id: string, options?: RequestOptions): Promise<Title> {
    return this.read<Title>(`/${encodeURIComponent(id)}`, options)
  }
}
