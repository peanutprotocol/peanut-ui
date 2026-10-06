import { setupChannelsForResidence } from '../paymentChannels'
import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'

it.each([
    ['BR', ['pix', 'crypto', 'peanut'], ['pix', 'peanut']],
    ['AR', ['arQr', 'crypto', 'peanut'], ['arQr', 'peanut']],
    ['PT', ['eurSepa', 'gbpFps', 'usdAch', 'crypto', 'peanut'], ['card', 'eurSepa', 'gbpFps', 'usdAch', 'peanut']],
    ['US', ['usdAch', 'eurSepa', 'gbpFps', 'crypto', 'peanut'], ['card', 'usdAch', 'eurSepa', 'gbpFps', 'peanut']],
    ['UA', ['crypto', 'peanut'], ['peanut']],
    ['GB', ['crypto', 'peanut'], ['peanut']],
    ['', ['crypto', 'peanut'], ['peanut']],
])('offers only residence-supported channels for %s, with Peanut last', (country, funding, payment) => {
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

it('server restrictions override the static rail map', () => {
    const sets = { ...LOCAL_RESIDENCE_RESTRICTION_SETS, full: new Set(['PT']) }
    expect(setupChannelsForResidence(sets, ' pt ', true)).toEqual({
        funding: ['crypto', 'peanut'],
        payment: ['peanut'],
    })
})
