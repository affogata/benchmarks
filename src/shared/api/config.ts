/** Where the public Affogata API lives when `VITE_API_BASE_URL` says nothing. */
export const DEFAULT_API_BASE_URL = 'https://app.affogata.com'

/**
 * Origin the resources layer talks to. Trailing slashes are stripped so resource paths
 * can always start with one, and a relative value (`/`) is legal for same-origin proxying.
 */
export const apiBaseUrl = (): string =>
  String(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
