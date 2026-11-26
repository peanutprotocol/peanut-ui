import { cadenceLabel, groupFunnelMap, waitLabel } from '../funnelMap'
import type { FunnelMapEntry } from '../journeyTypes'

const entry = (type: string, funnel: FunnelMapEntry['funnel'], afterMinutes = [0]): FunnelMapEntry => ({
    type,
    funnel,
    channels: ['push', 'email'],
    emailStandsInForPush: false,
    afterMinutes,
})

describe('funnel map', () => {
    it('labels each rung the way the cadence table reads: at once, minutes, hours, whole days', () => {
        expect([0, 30, 60, 1380, 2160, 10080].map(waitLabel)).toEqual([
            'at once',
            '+30 min',
            '+1 h',
            '+23 h',
            '+36 h',
            '+7 d',
        ])
        expect(
            cadenceLabel(entry('lifecycle.add_money_1', { lane: 'verified', trigger: 'timer' }, [60, 1380, 10080]))
        ).toBe('+1 h · +23 h · +7 d')
        expect(cadenceLabel(entry('lifecycle.welcome', { lane: 'signup', trigger: 'timer' }, []))).toBe('next cycle')
    })

    it('groups by lane in funnel order, keeps an unknown lane, puts non-funnel templates last and events first', () => {
        const groups = groupFunnelMap([
            entry('card.statement', 'outside'),
            entry('lifecycle.add_money_2', { lane: 'verified', trigger: 'timer' }, [1380]),
            entry('kyc.approved', { lane: 'verified', trigger: 'event' }),
            entry('lifecycle.welcome', { lane: 'signup', trigger: 'timer' }),
            entry('brand.new', { lane: 'brand_new_lane', trigger: 'event' }),
        ])
        expect(groups.map((group) => group.lane)).toEqual(['signup', 'verified', 'brand_new_lane', 'outside'])
        expect(groups[1].entries.map((e) => e.type)).toEqual(['kyc.approved', 'lifecycle.add_money_2'])
    })
})
