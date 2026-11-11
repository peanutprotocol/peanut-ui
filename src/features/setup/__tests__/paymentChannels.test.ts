import { setupChannelsForResidence } from '../paymentChannels'
import { RESIDENCE_RESTRICTION_SETS } from '@/test-utils/residenceRestrictions.fixture'
import { KYC_INTENTS_BY_COUNTRY } from '@/test-utils/kycIntents.fixture'
import { LOCAL_SERVED_ELSEWHERE_REASON } from '@/features/kyc-features/report'

it.each([
    ['BR', ['brlBank', 'bank', 'crypto', 'peanut'], ['card', 'qr']],
    ['AR', ['arsBank', 'bank', 'crypto', 'peanut'], ['card', 'qr']],
    ['PT', ['bank', 'crypto', 'peanut'], ['card', 'qr']],
    ['US', ['bank', 'crypto', 'peanut'], ['card', 'qr']],
    ['NG', ['bank', 'crypto', 'peanut'], ['qr']],
    ['HK', ['bank', 'crypto', 'peanut'], ['card', 'qr']],
    ['UA', ['bank', 'crypto', 'peanut'], ['qr']],
    ['IN', ['bank', 'crypto', 'peanut'], ['qr']],
    ['JP', ['crypto', 'peanut'], ['card', 'qr']],
    ['GB', ['crypto', 'peanut'], ['qr']],
    ['IR', ['crypto', 'peanut'], ['peanut']],
    ['', ['crypto', 'peanut'], ['peanut']],
])('offers residence-supported providers for %s; spending is the card and QR', (country, funding, payment) => {
    expect(setupChannelsForResidence(RESIDENCE_RESTRICTION_SETS, country as string, true)).toEqual({
        funding,
        payment,
    })
})
// the API refuses a resident of Brazil the local feature because Pix comes from another entry, its route
it("keeps Brazil's bank where another entry serves the residence, and closes it for a residence refusal", () => {
    const brazil = (reason: string) => ({
        ...KYC_INTENTS_BY_COUNTRY.BR,
        local: { available: false, reason } as typeof KYC_INTENTS_BY_COUNTRY.BR.local,
    })
    expect(
        setupChannelsForResidence(RESIDENCE_RESTRICTION_SETS, 'BR', true, brazil(LOCAL_SERVED_ELSEWHERE_REASON)).funding
    ).toEqual(['brlBank', 'bank', 'crypto', 'peanut'])
    expect(
        setupChannelsForResidence(RESIDENCE_RESTRICTION_SETS, 'BR', true, brazil('local_residence_unsupported')).funding
    ).toEqual(['bank', 'crypto', 'peanut'])
})

it('offers only universal channels before the server lookup settles', () => {
    expect(setupChannelsForResidence(RESIDENCE_RESTRICTION_SETS, 'PT', false)).toEqual({
        funding: ['crypto', 'peanut'],
        payment: ['peanut'],
    })
})
it('without server intents, a full banking/card restriction leaves QR open', () => {
    const sets = { ...RESIDENCE_RESTRICTION_SETS, full: new Set(['BR']) }
    expect(setupChannelsForResidence(sets, ' br ', true)).toEqual({
        funding: ['crypto', 'peanut'],
        payment: ['qr'],
    })
})

it('has no hardcoded country exclusion beyond the supplied fallback restrictions', () => {
    const sets = {
        ...RESIDENCE_RESTRICTION_SETS,
        refusedIdIssuers: new Set<string>(),
        full: new Set<string>(),
        bankingOnly: new Set<string>(),
        cardOnly: new Set<string>(),
    }
    expect(setupChannelsForResidence(sets, 'IR', true)).toEqual({
        funding: ['bank', 'crypto', 'peanut'],
        payment: ['card', 'qr'],
    })
})

it('uses server QR eligibility independently of bank and card eligibility', () => {
    const intents = {
        qr: { available: true },
        local: { available: false },
        bank: { available: false, currencies: [] },
        card: { available: false },
    }
    expect(setupChannelsForResidence(RESIDENCE_RESTRICTION_SETS, 'GB', true, intents)).toEqual({
        funding: ['crypto', 'peanut'],
        payment: ['qr'],
    })
    expect(
        setupChannelsForResidence(RESIDENCE_RESTRICTION_SETS, 'PT', true, {
            ...intents,
            qr: { available: false },
        })
    ).toEqual({
        funding: ['crypto', 'peanut'],
        payment: ['peanut'],
    })
})
