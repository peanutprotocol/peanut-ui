import { createHash } from 'node:crypto'

export const MARKETING_SLICE_CAP = 24
export const MARKETING_ORDER_BASE = 900_000
const localeSlugs = { en: 'en', 'es-419': 'es-419', 'es-AR': 'es-ar', 'pt-BR': 'pt-br' }
// Unprefixed sitemap pages are English and belong to the English capture.
const unprefixed = new Set(['/', '/careers', '/shhhhh'])

/** Pathnames from a sitemap that render in this capture locale, sorted and unique. */
export function marketingPaths(sitemapXml, locale) {
    const slug = localeSlugs[locale]
    if (!slug) throw new Error(`Unsupported marketing locale: ${locale}`)
    const paths = new Set()
    for (const [, loc] of sitemapXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
        let pathname
        try {
            pathname = new URL(loc.replaceAll('&amp;', '&')).pathname.replace(/\/+$/, '') || '/'
        } catch {
            continue
        }
        const first = pathname.split('/')[1]?.toLowerCase()
        if (first === slug || (locale === 'en' && unprefixed.has(pathname))) paths.add(pathname)
    }
    return [...paths].sort()
}

/** Stable state ID for one slice of a page; long paths keep a readable prefix plus a digest. */
export function marketingScreenId(pathname, slice) {
    let slug =
        pathname
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'root'
    if (slug.length > 96)
        slug = `${slug.slice(0, 86).replace(/-+$/, '')}-${createHash('sha256').update(pathname).digest('hex').slice(0, 8)}`
    return `mkt-${slug}-${slice}`
}

const words = (segment) => segment.replaceAll('-', ' ').replace(/^./, (letter) => letter.toUpperCase())

export function marketingFlow(pathname) {
    const segments = pathname.split('/').filter(Boolean)
    const rest = Object.values(localeSlugs).includes(segments[0]?.toLowerCase()) ? segments.slice(1) : segments
    if (!rest.length) return 'Marketing · Landing'
    if (rest.length === 1 && !['help', 'stories', 'content', 'pricing', 'supported-networks'].includes(rest[0]))
        return ['careers', 'shhhhh', 'privacy', 'terms'].includes(rest[0]) || rest[0].startsWith('card-')
            ? 'Marketing · Company and legal'
            : 'Marketing · Countries'
    return `Marketing · ${words(rest[0])}`
}

/** Viewport-sized offsets down a page; the last slice is pinned to the page bottom so every pixel is real. */
export function sliceOffsets(pageHeight, viewport, cap = MARKETING_SLICE_CAP) {
    if (!Number.isFinite(pageHeight) || pageHeight <= 0 || !Number.isInteger(viewport) || viewport <= 0)
        throw new Error('Invalid page geometry')
    const last = Math.max(0, Math.ceil(pageHeight) - viewport)
    const tops = []
    for (let top = 0; top < last; top += viewport) tops.push(top)
    const offsets = [...new Set([...tops, last])]
    if (offsets.length <= cap) return { offsets, truncated: false }
    return { offsets: [...offsets.slice(0, cap - 1), last], truncated: true }
}

/** Browser function: finishes every finite animation so a scrolled-in section is painted at rest. */
export function finishPageAnimations() {
    for (const animation of document.getAnimations())
        if (animation.playState !== 'finished' && Number.isFinite(animation.effect?.getComputedTiming().endTime))
            animation.finish()
}
