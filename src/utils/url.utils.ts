import { BASE_URL } from '@/constants/general.consts'

/**
 * Build an absolute URL on the current origin for user-shareable links
 * (receipts, claim pages, payment requests). On the client we use
 * `window.location.origin` so a share from staging stays on staging — without
 * this, `NEXT_PUBLIC_BASE_URL` falls back to peanut.me and breaks staging
 * QA. SSR/tests fall back to the build-time `BASE_URL`.
 */
export function shareableUrl(path: string): string {
    const base = typeof window !== 'undefined' ? window.location.origin : BASE_URL
    if (path.startsWith('http://') || path.startsWith('https://')) return path
    return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
