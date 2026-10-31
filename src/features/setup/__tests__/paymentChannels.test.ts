import { setupChannelsForResidence } from '../paymentChannels'
import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'

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
    ['GB', ['crypto', 'peanut'], ['peanut']],
    ['IR', ['crypto', 'peanut'], ['peanut']],
    ['', ['crypto', 'peanut'], ['peanut']],
])('offers residence-supported providers for %s; spending is the card and QR', (country, funding, payment) => {
    expect(setupChannelsForResidence(LOCAL_RESIDENCE_RESTRICTION_SETS, country as string, true)).toEqual({
        funding,
        payment,
    })
})
it('offers only universal channels before the server lookup settles', () => {
    expect(setupChannelsForResidence(LOCAL_RESIDENCE_RESTRICTION_SETS, 'PT', false)).toEqual({
        funding: ['crypto', 'peanut'],
        payment: ['peanut'],
    })
})
it('without server intents, a full restriction also closes QR', () => {
    const sets = { ...LOCAL_RESIDENCE_RESTRICTION_SETS, full: new Set(['BR']) }
    expect(setupChannelsForResidence(sets, ' br ', true)).toEqual({
        funding: ['crypto', 'peanut'],
        payment: ['peanut'],
    })
})

it('has no hardcoded country exclusion beyond the supplied fallback restrictions', () => {
    const sets = { full: new Set<string>(), bankingOnly: new Set<string>(), cardOnly: new Set<string>() }
    expect(setupChannelsForResidence(sets, 'IR', true)).toEqual({
        funding: ['bank', 'crypto', 'peanut'],
        payment: ['card', 'qr'],
    })
})

it('uses server QR eligibility independently of bank and card eligibility', () => {
    const intents = {
        qr: { available: true },
        local: { available: false },
        bank: { available: false },
        card: { available: false },
    }
    expect(setupChannelsForResidence(LOCAL_RESIDENCE_RESTRICTION_SETS, 'GB', true, intents)).toEqual({
        funding: ['crypto', 'peanut'],
        payment: ['qr'],
    })
    expect(
        setupChannelsForResidence(LOCAL_RESIDENCE_RESTRICTION_SETS, 'PT', true, {
            ...intents,
            qr: { available: false },
        })
    ).toEqual({
        funding: ['crypto', 'peanut'],
        payment: ['peanut'],
    })
})
