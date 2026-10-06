import { setupChannelsForResidence } from '../paymentChannels'
import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'

it.each([
    ['BR', ['brlBank', 'bank', 'crypto', 'peanut'], ['card', 'bank', 'pix', 'crypto', 'peanut']],
    ['AR', ['arsBank', 'bank', 'crypto', 'peanut'], ['card', 'bank', 'arQr', 'crypto', 'peanut']],
    ['PT', ['bank', 'crypto', 'peanut'], ['card', 'bank', 'crypto', 'peanut']],
    ['US', ['bank', 'crypto', 'peanut'], ['card', 'bank', 'crypto', 'peanut']],
    ['UA', ['crypto', 'peanut'], ['crypto', 'peanut']],
    ['JP', ['crypto', 'peanut'], ['card', 'crypto', 'peanut']],
    ['GB', ['crypto', 'peanut'], ['crypto', 'peanut']],
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
it('server restrictions override both local and Bridge eligibility', () => {
    const sets = { ...LOCAL_RESIDENCE_RESTRICTION_SETS, full: new Set(['BR']) }
    expect(setupChannelsForResidence(sets, ' br ', true)).toEqual({
        funding: ['crypto', 'peanut'],
        payment: ['crypto', 'peanut'],
    })
})
