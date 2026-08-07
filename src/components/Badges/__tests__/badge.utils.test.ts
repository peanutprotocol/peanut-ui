import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { BADGE_ASSET_FALLBACKS, getBadgeDescription, getBadgeDisplayName, getBadgeIcon } from '../badge.utils'

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

    it('never overrides API name or description with local catalog copy', () => {
        expect(getBadgeDisplayName('CARD_PIONEER', 'Backend Pioneer')).toBe('Backend Pioneer')
        expect(getBadgeDescription('Backend-owned description')).toBe('Backend-owned description')
    })

    it('keeps incomplete or unknown legacy responses readable without inventing copy', () => {
        expect(getBadgeDisplayName('FUTURE_BADGE', null)).toBe('FUTURE_BADGE')
        expect(getBadgeDisplayName(undefined, null)).toBe('Badge')
        expect(getBadgeDescription(null)).toBeNull()
    })
})
