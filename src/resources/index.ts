/**
 * The resources layer: typed access to the public Affogata API, one resource per entity.
 *
 *   resources/  →  shared/api (transport)  →  fetch
 *        ↑
 *   domain repository / stores
 *
 * Resources import domain *types* only. Nothing here knows about Vue, Pinia or the router,
 * so a resource is usable from a store, a WebMCP tool or a script without change.
 */
import { HttpClient } from '@/shared/api'
import { CategoriesResource } from './categories.resource'
import { IndustriesResource } from './industries.resource'
import { MetaResource } from './meta.resource'
import { SnapshotResource } from './snapshot.resource'
import { TitlesResource } from './titles.resource'

export * from './base.resource'
export * from './categories.resource'
export * from './endpoints'
export * from './industries.resource'
export * from './meta.resource'
export * from './snapshot.resource'
export * from './titles.resource'

export interface BenchmarksApi {
  snapshot: SnapshotResource
  meta: MetaResource
  industries: IndustriesResource
  categories: CategoriesResource
  titles: TitlesResource
}

/** Builds a set of resources over one client — pass a client to point at another origin. */
export const createBenchmarksApi = (client: HttpClient = new HttpClient()): BenchmarksApi => ({
  snapshot: new SnapshotResource(client),
  meta: new MetaResource(client),
  industries: new IndustriesResource(client),
  categories: new CategoriesResource(client),
  titles: new TitlesResource(client),
})

/** The app-wide instance, aimed at `VITE_API_BASE_URL`. */
export const benchmarksApi: BenchmarksApi = createBenchmarksApi()
