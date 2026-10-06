import { setupChannelsForResidence } from '../paymentChannels'
import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'

it.each([
    ['BR', ['brlBank', 'bank', 'crypto', 'peanut'], ['card', 'bank', 'pix', 'arQr', 'crypto', 'peanut']],
    ['AR', ['arsBank', 'bank', 'crypto', 'peanut'], ['card', 'bank', 'pix', 'arQr', 'crypto', 'peanut']],
    ['PT', ['bank', 'crypto', 'peanut'], ['card', 'bank', 'pix', 'arQr', 'crypto', 'peanut']],
    ['US', ['bank', 'crypto', 'peanut'], ['card', 'bank', 'pix', 'arQr', 'crypto', 'peanut']],
    ['NG', ['bank', 'crypto', 'peanut'], ['card', 'bank', 'pix', 'arQr', 'crypto', 'peanut']],
    ['HK', ['bank', 'crypto', 'peanut'], ['card', 'bank', 'pix', 'arQr', 'crypto', 'peanut']],
    ['UA', ['bank', 'crypto', 'peanut'], ['bank', 'pix', 'arQr', 'crypto', 'peanut']],
    ['IN', ['bank', 'crypto', 'peanut'], ['bank', 'pix', 'arQr', 'crypto', 'peanut']],
    ['JP', ['crypto', 'peanut'], ['card', 'pix', 'arQr', 'crypto', 'peanut']],
    ['GB', ['crypto', 'peanut'], ['pix', 'arQr', 'crypto', 'peanut']],
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
        payment: ['pix', 'arQr', 'crypto', 'peanut'],
    })
})
