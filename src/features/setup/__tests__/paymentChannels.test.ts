import { setupChannelsForResidence } from '../paymentChannels'
import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'

it.each([
    ['BR', ['brlBank', 'bank', 'crypto', 'peanut'], ['card', 'qr']],
    ['AR', ['arsBank', 'bank', 'crypto', 'peanut'], ['card', 'qr']],
    ['PT', ['bank', 'crypto', 'peanut'], ['card', 'qr']],
    ['US', ['bank', 'crypto', 'peanut'], ['card', 'qr']],
    ['NG', ['bank', 'crypto', 'peanut'], ['card', 'qr']],
    ['HK', ['bank', 'crypto', 'peanut'], ['card', 'qr']],
    ['UA', ['bank', 'crypto', 'peanut'], ['qr']],
    ['IN', ['bank', 'crypto', 'peanut'], ['qr']],
    ['JP', ['crypto', 'peanut'], ['card', 'qr']],
    ['GB', ['crypto', 'peanut'], ['qr']],
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
it('server bank/card restrictions do not decide the separate QR eligibility', () => {
    const sets = { ...LOCAL_RESIDENCE_RESTRICTION_SETS, full: new Set(['BR']) }
    expect(setupChannelsForResidence(sets, ' br ', true)).toEqual({
        funding: ['crypto', 'peanut'],
        payment: ['qr'],
    })
})
