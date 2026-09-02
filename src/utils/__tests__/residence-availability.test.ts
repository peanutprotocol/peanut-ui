import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'
import { residenceAvailability, type AvailabilityRailKey } from '@/utils/residence-availability'
import { isBridgeSupportedCountry } from '@/utils/regions.utils'
import { buildUnlockGroups, type UnlockRowLabelKey } from '@/utils/unlock-payments.utils'

const sets = LOCAL_RESIDENCE_RESTRICTION_SETS

describe('residenceAvailability', () => {
    it('a Bridge-served residence lists every Bridge rail, its own currency first', () => {
        expect(residenceAvailability(sets, 'PT').available).toEqual(['p2p', 'eurSepa', 'gbpFps', 'usdAch', 'card'])
        expect(residenceAvailability(sets, 'DE').available).toEqual(['p2p', 'eurSepa', 'gbpFps', 'usdAch', 'card'])
        expect(residenceAvailability(sets, 'US').available).toEqual(['p2p', 'usdAch', 'eurSepa', 'gbpFps', 'card'])
    })

    it('Mexico adds SPEI on top of the Bridge set', () => {
        expect(residenceAvailability(sets, 'MX').available).toEqual([
            'p2p',
            'spei',
            'eurSepa',
            'gbpFps',
            'usdAch',
            'card',
        ])
    })

    it('Brazil and Argentina ride Manteca only — they are not in the Bridge map', () => {
        expect(isBridgeSupportedCountry('BR')).toBe(false)
        expect(isBridgeSupportedCountry('AR')).toBe(false)
        expect(residenceAvailability(sets, 'BR').available).toEqual(['p2p', 'pix', 'card'])
        expect(residenceAvailability(sets, 'AR').available).toEqual(['p2p', 'arQr', 'card'])
    })

    it('rest of world reads bank transfers where supported, never a specific rail', () => {
        expect(residenceAvailability(sets, 'NG').available).toEqual(['p2p', 'bank', 'card'])
    })

    it('restriction tiers surface as unavailable instead of overstating', () => {
        // Banking-only restriction (Bridge does not onboard JP residents)
        const jp = residenceAvailability(sets, 'JP')
        expect(jp.unavailable).toEqual(['banking'])
        expect(jp.available).toEqual(['p2p', 'card'])
        // Card-only restriction (Rain's issuance list)
        const tr = residenceAvailability(sets, 'TR')
        expect(tr.unavailable).toEqual(['card'])
        // Full restriction
        const ru = residenceAvailability(sets, 'RU')
        expect(ru.unavailable).toEqual(['banking', 'card'])
        expect(ru.available).toEqual(['p2p'])
    })

    it('is case-insensitive on input', () => {
        expect(residenceAvailability(sets, 'br').iso2).toBe('BR')
    })
})

// The signup summary and the Unlock payments screen must tell one story: every
// rail the summary lists for a residence has to be an unlockable row on Unlock
// payments for that same residence.
describe('residenceAvailability vs buildUnlockGroups', () => {
    const ROW_FOR_RAIL: Record<AvailabilityRailKey, UnlockRowLabelKey> = {
        pix: 'saBank',
        arQr: 'saBank',
        spei: 'naBank',
        usdAch: 'naBank',
        eurSepa: 'sepa',
        gbpFps: 'sepa',
    }

    const isRail = (item: string): item is AvailabilityRailKey => item in ROW_FOR_RAIL

    const unlockRowsFor = (iso2: string) => {
        const restrictions = deriveResidenceRestrictionsFrom(sets, iso2)
        return buildUnlockGroups({
            regionChips: { europe: 'unlock', 'north-america': 'unlock', latam: 'unlock' },
            qrOnly: { brazil: false, argentina: false },
            restrictions,
            card: 'get',
            residenceIso2: iso2,
            isEuropeResidence: iso2 !== 'US' && iso2 !== 'MX' && isBridgeSupportedCountry(iso2),
        }).flatMap((group) => group.rows)
    }

    it.each(['PT', 'DE', 'GB', 'US', 'MX', 'BR', 'AR', 'NG', 'JP', 'TR', 'RU'])(
        'every rail the summary lists for %s is an unlockable row on Unlock payments',
        (iso2) => {
            const rails = residenceAvailability(sets, iso2).available.filter(isRail)
            const rows = unlockRowsFor(iso2)
            for (const rail of rails) {
                const row = rows.find((candidate) => candidate.labelKey === ROW_FOR_RAIL[rail])
                expect(row).toBeDefined()
                expect(row?.chip).not.toBe('notAvailable')
            }
        }
    )

    it('a banking-restricted residence lists no rail and Unlock payments marks every bank row unavailable', () => {
        for (const iso2 of ['JP', 'RU']) {
            expect(residenceAvailability(sets, iso2).available.filter(isRail)).toEqual([])
            const bankRows = unlockRowsFor(iso2).filter((row) => row.id !== 'p2p' && row.id !== 'card')
            expect(bankRows.every((row) => row.chip === 'notAvailable')).toBe(true)
        }
    })
})
