import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BADGE_ASSET_FALLBACKS, getBadgeIcon, getBadgeShareText } from '../badge.utils'

describe('backend-owned badge presentation', () => {
    // UI half of the cross-repo asset contract. BADGE_ASSET_FALLBACKS is now
    // generated from peanut-api-ts docs/badge-assets.json, so this fails when a
    // badge is added to the backend catalog without its artwork landing here.
    // The API half asserts the manifest still matches the catalog.
    it('resolves every badge asset the backend catalog declares', () => {
        const paths = Object.values(BADGE_ASSET_FALLBACKS)
        expect(paths.length).toBeGreaterThan(40)
        for (const iconPath of paths) {
            expect({ iconPath, exists: existsSync(join(process.cwd(), 'public', iconPath)) }).toEqual({
                iconPath,
                exists: true,
            })
        }
    })

    it('keeps the NAIJA and TERERE launch artwork available during catalog rolling deploys', () => {
        expect(BADGE_ASSET_FALLBACKS.NAIJA).toBe('/badges/naija.svg')
        expect(BADGE_ASSET_FALLBACKS.TERERE).toBe('/badges/terere.svg')
    })

    it('prefers the API icon URL over legacy local artwork', () => {
        expect(getBadgeIcon('WAITLIST_SKIP', '/badges/authoritative.avif')).toBe('/badges/authoritative.avif')
    })

    it.each([
        'https://cdn.example/badge.svg',
        'data:image/svg+xml;base64,PHN2Zy8+',
        '/badges/../secret.svg',
        '/badges/good.svg?cache=1',
        '/badges/good.svg#fragment',
        '/badges/script.html',
        '/catalog/badge.svg',
        ' /badges/good.svg ',
    ])('rejects unsafe API icon URL %s and falls back by badge code', (iconUrl) => {
        expect(getBadgeIcon('WAITLIST_SKIP', iconUrl)).toBe(BADGE_ASSET_FALLBACKS.WAITLIST_SKIP)
    })

    it('uses generic artwork when an unknown badge carries an unsafe icon URL', () => {
        expect(getBadgeIcon('FUTURE_BADGE', 'javascript:alert(1)')).toBe(getBadgeIcon())
    })

    it('uses local artwork only when a known legacy response omits iconUrl', () => {
        expect(getBadgeIcon('WAITLIST_SKIP')).toBe(BADGE_ASSET_FALLBACKS.WAITLIST_SKIP)
    })

    it('uses generic artwork for an unknown code without an iconUrl', () => {
        expect(typeof getBadgeIcon('NOT_A_REAL_BADGE')).toBe('string')
        expect(getBadgeIcon('NOT_A_REAL_BADGE')).toBeTruthy()
        expect(getBadgeIcon(undefined)).toBe(getBadgeIcon('NOT_A_REAL_BADGE'))
    })
})

describe('getBadgeShareText', () => {
    const url = 'https://peanut.me/satoshi'

    it('uses the badge-specific brag line for a known code (not the generic fallback) and appends the profile url', () => {
        // Copy-agnostic on purpose: assert a mapped code yields something OTHER than
        // the generic fallback, so editing a line never breaks this test.
        const mapped = getBadgeShareText('CARD_FIRST_SWIPE', 'First Swipe', url)
        const fallback = getBadgeShareText('___UNMAPPED___', 'First Swipe', url)
        expect(mapped).not.toBe(fallback)
        expect(mapped).toContain(url)
        // first-person voice — the sharer is bragging about themselves
        expect(mapped).toMatch(/\b(I|my)\b/i)
    })

    it('uses bespoke copy for the runtime English locale options path', () => {
        const text = getBadgeShareText('CARD_FIRST_SWIPE', 'First Swipe', url, {
            locale: 'en',
            localizedFallback: 'localized fallback sentinel',
        })

        expect(text).not.toContain('localized fallback sentinel')
        expect(text).toContain(url)
    })

    it('includes bespoke copy for the MANICERO badge added after the original PR', () => {
        const mapped = getBadgeShareText('MANICERO', 'Manicero', url)
        const fallback = getBadgeShareText('___UNMAPPED___', 'Manicero', url)

        expect(mapped).not.toBe(fallback)
    })

    it('falls back to a generic brag (with display name) for unknown / parked codes', () => {
        const text = getBadgeShareText('NOT_A_REAL_BADGE', 'Mystery Badge', url)
        expect(text).toContain('Mystery Badge')
        expect(text).toContain(url)
    })

    it('still produces shareable text when the code is undefined', () => {
        const text = getBadgeShareText(undefined, 'Some Badge', url)
        expect(text).toContain('Some Badge')
        expect(text).toContain(url)
    })

    it('keeps the localized generic copy outside English', () => {
        const localizedFallback = `Ganhei o selo First Swipe no Peanut!\n\n${url}`

        expect(
            getBadgeShareText('CARD_FIRST_SWIPE', 'First Swipe', url, {
                locale: 'pt-BR',
                localizedFallback,
            })
        ).toBe(localizedFallback)
    })
})

// TASK-22677: badge art ships on one square canvas that a slot cannot stretch.
// Mixed canvases (2048x1455 beside 2048x2048) drew art anywhere between 17px
// and 40px tall in the same 40px slot, and preserveAspectRatio="none" let any
// box without object-contain squash it. mono/skills/badges-recraft
// normalize-badge-canvas.mjs writes this shape; this keeps a hand-dropped
// file honest.
describe('badge artwork geometry', () => {
    const svgRoot = (svg: string) => svg.match(/<svg\b[^>]*>/)?.[0] ?? ''
    const svgViewBox = (root: string) => {
        const raw = root.match(/(?<![\w-])viewBox\s*=\s*"([^"]*)"/)?.[1] ?? ''
        const [, , width = 0, height = 0] = raw
            .trim()
            .split(/[\s,]+/)
            .map(Number)
        return { width, height }
    }
    const pngSize = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) })

    it('ships every catalog badge on a square canvas with no preserveAspectRatio=none', () => {
        for (const iconPath of Object.values(BADGE_ASSET_FALLBACKS)) {
            const file = join(process.cwd(), 'public', iconPath)
            if (iconPath.endsWith('.svg')) {
                const root = svgRoot(readFileSync(file, 'utf8'))
                const { width, height } = svgViewBox(root)
                const stretchable = /preserveAspectRatio\s*=\s*"none"/.test(root)
                expect({ iconPath, square: width > 0 && Math.abs(width - height) < 0.01, stretchable }).toEqual({
                    iconPath,
                    square: true,
                    stretchable: false,
                })
            } else {
                const { width, height } = pngSize(readFileSync(file))
                expect({ iconPath, square: width > 0 && width === height }).toEqual({ iconPath, square: true })
            }
        }
    })
})
