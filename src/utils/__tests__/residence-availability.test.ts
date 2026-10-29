import { featureReport } from '@/test-utils/featureReport.fixture'
import { accountEntry, entryChip } from '@/features/kyc-features/report'
import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'
import {
    bankRailsFor,
    residenceAvailability,
    spansMultipleCurrencies,
    type AvailabilityRailKey,
} from '@/utils/residence-availability'
import { isBridgeSupportedCountry, regionIntentForResidence } from '@/utils/regions.utils'
import { buildResidenceCountryOptions } from '@/utils/residence-options'
import { buildBankRows, type UnlockRowLabelKey } from '@/utils/unlock-payments.utils'
import { KYC_INTENTS_BY_COUNTRY } from '@/test-utils/kycIntents.fixture'

const sets = LOCAL_RESIDENCE_RESTRICTION_SETS

describe('residenceAvailability', () => {
    it('a residence whose intent is Bridge lists the Bridge set, its own currency first', () => {
        expect(regionIntentForResidence('PT')).toBe('EU')
        expect(residenceAvailability(sets, 'PT').available).toEqual(['eurSepa', 'gbpFps', 'usdAch', 'card', 'p2p'])
        expect(residenceAvailability(sets, 'DE').available).toEqual(['eurSepa', 'gbpFps', 'usdAch', 'card', 'p2p'])
        expect(regionIntentForResidence('US')).toBe('NA')
        expect(residenceAvailability(sets, 'US').available).toEqual(['usdAch', 'eurSepa', 'gbpFps', 'card', 'p2p'])
    })

    it('Mexico adds SPEI on top of the Bridge set', () => {
        expect(residenceAvailability(sets, 'MX').available).toEqual([
            'spei',
            'eurSepa',
            'gbpFps',
            'usdAch',
            'card',
            'p2p',
        ])
    })

    it('a LATAM residence lists its own QR rail and no Bridge rail', () => {
        expect(regionIntentForResidence('BR')).toBe('LATAM')
        expect(regionIntentForResidence('AR')).toBe('LATAM')
        expect(residenceAvailability(sets, 'BR').available).toEqual(['pix', 'card', 'p2p'])
        expect(residenceAvailability(sets, 'AR').available).toEqual(['arQr', 'card', 'p2p'])
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
        expect(residenceAvailability(sets, 'KE').available).toEqual(['bank', 'card', 'p2p'])
    })

    it('restriction tiers surface as unavailable instead of overstating', () => {
        // Banking-only restriction (Bridge does not onboard JP residents)
        const jp = residenceAvailability(sets, 'JP')
        expect(jp.unavailable).toEqual(['banking'])
        expect(jp.available).toEqual(['card', 'p2p'])
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

// One verification really does enrol the whole regional set, so the extra rails
// are not a lie — but they only pay out into an account on their own network.
// A residence whose card spans several currencies says so as a condition
// instead of reading as "living here gets you GBP and USD too".
describe('multi-currency rail sets are qualified, not promised', () => {
    it('a Bridge residence spans several currencies', () => {
        for (const iso2 of ['PT', 'DE', 'US', 'MX']) {
            expect(residenceAvailability(sets, iso2).multiCurrency).toBe(true)
        }
    })

    it('a single-rail residence does not', () => {
        expect(residenceAvailability(sets, 'BR').multiCurrency).toBe(false)
        expect(residenceAvailability(sets, 'AR').multiCurrency).toBe(false)
        // rest of world lists the currency-less "where supported" placeholder
        expect(residenceAvailability(sets, 'NG').multiCurrency).toBe(false)
        expect(residenceAvailability(sets, 'GB').multiCurrency).toBe(false)
    })

    it('a banking-restricted residence lists no rail to qualify', () => {
        const jp = residenceAvailability(sets, 'JP')
        expect(jp.unavailable).toEqual(['banking'])
        expect(jp.multiCurrency).toBe(false)
    })

    it('ignores the non-rail items so the card never qualifies P2P or the card', () => {
        expect(spansMultipleCurrencies(['card', 'p2p'])).toBe(false)
        expect(spansMultipleCurrencies(['bank', 'card', 'p2p'])).toBe(false)
        expect(spansMultipleCurrencies(['eurSepa', 'card', 'p2p'])).toBe(false)
        expect(spansMultipleCurrencies(['eurSepa', 'usdAch', 'card', 'p2p'])).toBe(true)
    })
})

// Drift guard between the two surfaces that render the same static rail
// knowledge. This does NOT establish that a rail serves a residence — that
// comes from the residence's verification intent (`bankRailsFor`, asserted
// above against `regionIntentForResidence`). What it catches is the DS-review
// failure itself: signup naming a rail that Unlock payments then shows as
// unavailable for the same residence.
describe('residenceAvailability vs buildBankRows', () => {
    const ROW_FOR_RAIL: Record<AvailabilityRailKey, UnlockRowLabelKey> = {
        pix: 'brl',
        arQr: 'ars',
        spei: 'mxn',
        usdAch: 'usd',
        eurSepa: 'sepa',
        gbpFps: 'sepa',
    }

    const isRail = (item: string): item is AvailabilityRailKey => item in ROW_FOR_RAIL

    const unlockRowsFor = (iso2: string) => {
        const restrictions = deriveResidenceRestrictionsFrom(sets, iso2)
        const report = featureReport({
            rails: [],
            nextActions: [],
            identity: { status: 'verified' },
            residence: iso2,
            restrictions: {
                banking: restrictions.banking
                    ? { code: 'residence_bank_restricted', userMessage: 'Unavailable' }
                    : null,
                card: restrictions.card,
            },
            productRefusals: restrictions.banking ? { 'manteca.local': 'residence_bank_restricted' } : {},
        })
        return buildBankRows({
            bankChips: {
                brl: entryChip(accountEntry(report, 'local', 'BRL'), []),
                ars: entryChip(accountEntry(report, 'local', 'ARS'), []),
                usd: entryChip(accountEntry(report, 'bank', 'USD'), []),
                mxn: entryChip(accountEntry(report, 'bank', 'MXN'), []),
                sepa: entryChip(accountEntry(report, 'bank', 'EUR'), []),
            },
            closedBecause: { brl: 'residence', ars: 'residence' },
            residenceIso2: iso2,
            isEuropeResidence: iso2 !== 'US' && iso2 !== 'MX' && isBridgeSupportedCountry(iso2),
        })
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
            const bankRows = unlockRowsFor(iso2).filter(
                (row) => row.id !== 'p2p' && row.id !== 'card' && row.id !== 'crypto'
            )
            expect(bankRows.every((row) => row.chip === 'notAvailable')).toBe(true)
        }
    })
})

// Slava, 2026-10-27: the comparison listed the wrong things for 178 of 250
// countries. With the server's answer it lists what the verification will open.
describe('residenceAvailability from the server intents', () => {
    const of = (iso2: string) =>
        residenceAvailability(LOCAL_RESIDENCE_RESTRICTION_SETS, iso2, KYC_INTENTS_BY_COUNTRY[iso2])

    it('names the bank currencies wherever the bank feature is open, not "where supported"', () => {
        expect(of('MK').available).toEqual(['usdAch', 'eurSepa', 'gbpFps', 'card', 'p2p'])
        expect(of('MK').unavailable).toEqual([])
    })

    it('lists Brazil and Argentina their local rail and the bank accounts both', () => {
        expect(of('BR').available).toEqual(['pix', 'usdAch', 'eurSepa', 'gbpFps', 'card', 'p2p'])
        expect(of('AR').available).toEqual(['arQr', 'usdAch', 'eurSepa', 'gbpFps', 'card', 'p2p'])
    })

    it('leads with the home currency in Mexico and the US', () => {
        expect(of('MX').available.slice(0, 2)).toEqual(['spei', 'usdAch'])
        expect(of('US').available[0]).toBe('usdAch')
    })

    it('says what the server closes, even where no tier list names it', () => {
        expect(of('KR').unavailable).toEqual(['banking'])
        expect(of('KR').available).toEqual(['card', 'p2p'])
        expect(of('VE').unavailable).toEqual(['banking', 'card'])
        expect(of('VE').available).toEqual(['p2p'])
    })
})
