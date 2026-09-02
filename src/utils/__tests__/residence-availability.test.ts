import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'
import { bankRailsFor, residenceAvailability, type AvailabilityRailKey } from '@/utils/residence-availability'
import { isBridgeSupportedCountry, regionIntentForResidence } from '@/utils/regions.utils'
import { buildResidenceCountryOptions } from '@/utils/residence-options'
import { buildUnlockGroups, type UnlockRowLabelKey } from '@/utils/unlock-payments.utils'

const sets = LOCAL_RESIDENCE_RESTRICTION_SETS

describe('residenceAvailability', () => {
    it('a residence whose intent is Bridge lists the Bridge set, its own currency first', () => {
        expect(regionIntentForResidence('PT')).toBe('EU')
        expect(residenceAvailability(sets, 'PT').available).toEqual(['p2p', 'eurSepa', 'gbpFps', 'usdAch', 'card'])
        expect(residenceAvailability(sets, 'DE').available).toEqual(['p2p', 'eurSepa', 'gbpFps', 'usdAch', 'card'])
        expect(regionIntentForResidence('US')).toBe('NA')
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

    it('a LATAM residence lists its own QR rail and no Bridge rail', () => {
        expect(regionIntentForResidence('BR')).toBe('LATAM')
        expect(regionIntentForResidence('AR')).toBe('LATAM')
        expect(residenceAvailability(sets, 'BR').available).toEqual(['p2p', 'pix', 'card'])
        expect(residenceAvailability(sets, 'AR').available).toEqual(['p2p', 'arQr', 'card'])
    })

    // The promise is derived from the residence's verification intent, so a
    // residence no bank provider onboards cannot be told about a rail — even
    // when Bridge's document map happens to list its country.
    it('a ROW-intent residence never names a rail, whatever the Bridge map says', () => {
        for (const iso2 of ['GB', 'JP', 'NG']) {
            expect(regionIntentForResidence(iso2)).toBe('ROW')
            expect(bankRailsFor(iso2)).toEqual(['bank'])
        }
        expect(isBridgeSupportedCountry('GB')).toBe(true)
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

// Drift guard between the two surfaces that render the same static rail
// knowledge. This does NOT establish that a rail serves a residence — that
// comes from the residence's verification intent (`bankRailsFor`, asserted
// above against `regionIntentForResidence`). What it catches is the DS-review
// failure itself: signup naming a rail that Unlock payments then shows as
// unavailable for the same residence.
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

    // Every country the residence picker offers, not a hand-picked sample — a
    // new country in `countryData` cannot slip through with a rail promise
    // Unlock payments contradicts.
    const everyResidence = buildResidenceCountryOptions('en').map((option) => option.value)

    it('every rail the summary lists is an unlockable row on Unlock payments, for every residence', () => {
        expect(everyResidence.length).toBeGreaterThan(50)
        for (const iso2 of everyResidence) {
            const rows = unlockRowsFor(iso2)
            for (const rail of residenceAvailability(sets, iso2).available.filter(isRail)) {
                const row = rows.find((candidate) => candidate.labelKey === ROW_FOR_RAIL[rail])
                expect({ iso2, rail, defined: !!row, chip: row?.chip }).toEqual({
                    iso2,
                    rail,
                    defined: true,
                    chip: expect.not.stringMatching(/^notAvailable$/),
                })
            }
        }
    })

    it('a banking-restricted residence lists no rail and Unlock payments marks every bank row unavailable', () => {
        for (const iso2 of ['JP', 'RU']) {
            expect(residenceAvailability(sets, iso2).available.filter(isRail)).toEqual([])
            const bankRows = unlockRowsFor(iso2).filter((row) => row.id !== 'p2p' && row.id !== 'card')
            expect(bankRows.every((row) => row.chip === 'notAvailable')).toBe(true)
        }
    })
})
