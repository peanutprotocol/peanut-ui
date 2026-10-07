import { setupChannelsForResidence } from '../paymentChannels'
import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'

it.each([
    ['BR', ['brlBank', 'bank', 'crypto', 'peanut'], ['card', 'bank', 'qr', 'crypto', 'peanut']],
    ['AR', ['arsBank', 'bank', 'crypto', 'peanut'], ['card', 'bank', 'qr', 'crypto', 'peanut']],
    ['PT', ['bank', 'crypto', 'peanut'], ['card', 'bank', 'qr', 'crypto', 'peanut']],
    ['US', ['bank', 'crypto', 'peanut'], ['card', 'bank', 'qr', 'crypto', 'peanut']],
    ['NG', ['bank', 'crypto', 'peanut'], ['card', 'bank', 'qr', 'crypto', 'peanut']],
    ['HK', ['bank', 'crypto', 'peanut'], ['card', 'bank', 'qr', 'crypto', 'peanut']],
    ['UA', ['bank', 'crypto', 'peanut'], ['bank', 'qr', 'crypto', 'peanut']],
    ['IN', ['bank', 'crypto', 'peanut'], ['bank', 'qr', 'crypto', 'peanut']],
    ['JP', ['crypto', 'peanut'], ['card', 'qr', 'crypto', 'peanut']],
    ['GB', ['crypto', 'peanut'], ['qr', 'crypto', 'peanut']],
    ['IR', ['crypto', 'peanut'], ['crypto', 'peanut']],
    ['', ['crypto', 'peanut'], ['crypto', 'peanut']],
])('offers residence-supported providers for %s, with Peanut last', (country, funding, payment) => {
    expect(setupChannelsForResidence(LOCAL_RESIDENCE_RESTRICTION_SETS, country as string, true)).toEqual({
        funding,
        payment,
    })
})
it('offers only universal channels before the server lookup settles', () => {
    expect(setupChannelsForResidence(LOCAL_RESIDENCE_RESTRICTION_SETS, 'PT', false)).toEqual({
        funding: ['crypto', 'peanut'],
        payment: ['crypto', 'peanut'],
    })
})
it('server bank/card restrictions do not decide the separate QR eligibility', () => {
    const sets = { ...LOCAL_RESIDENCE_RESTRICTION_SETS, full: new Set(['BR']) }
    expect(setupChannelsForResidence(sets, ' br ', true)).toEqual({
        funding: ['crypto', 'peanut'],
        payment: ['qr', 'crypto', 'peanut'],
    })
})
