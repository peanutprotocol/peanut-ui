import { withFeatureReport } from '@/test-utils/featureReport.fixture'
import type { RailCapability } from '@/types/capabilities'
import { selectHomeTasks } from '@/utils/bridge-tasks.utils'

const acceptanceCases = [
    {
        name: 'government ID follow-up',
        provider: 'bridge',
        status: 'requires-info',
        verdict: 'fixable',
        action: 'sumsub',
        requirement: 'government_id_front',
        bridgeTasks: 1,
    },
    {
        name: 'proof of address follow-up',
        provider: 'bridge',
        status: 'requires-info',
        verdict: 'fixable',
        action: 'sumsub',
        requirement: 'proof_of_address',
        bridgeTasks: 1,
    },
    {
        name: 'questionnaire follow-up',
        provider: 'bridge',
        status: 'requires-info',
        verdict: 'fixable',
        action: 'sumsub',
        requirement: 'questionnaire',
        bridgeTasks: 1,
    },
    {
        name: 'waiting verdict',
        provider: 'bridge',
        status: 'requires-info',
        verdict: 'wait',
        action: 'sumsub',
        requirement: 'government_id_front',
        bridgeTasks: 0,
    },
    {
        name: 'blocked verdict',
        provider: 'bridge',
        status: 'requires-info',
        verdict: 'blocked',
        action: 'sumsub',
        requirement: 'government_id_front',
        bridgeTasks: 0,
    },
    {
        name: 'final verdict',
        provider: 'bridge',
        status: 'requires-info',
        verdict: 'final',
        action: 'sumsub',
        requirement: 'government_id_front',
        bridgeTasks: 0,
    },
    {
        name: 'other provider',
        provider: 'rain',
        status: 'requires-info',
        verdict: 'fixable',
        action: 'sumsub',
        requirement: 'government_id_front',
        bridgeTasks: 0,
    },
    {
        name: 'active rail',
        provider: 'bridge',
        status: 'active',
        verdict: 'fixable',
        action: 'sumsub',
        requirement: 'government_id_front',
        bridgeTasks: 0,
    },
] as const

type Action = Parameters<typeof selectHomeTasks>[0][number]
type Rail = RailCapability
type AcceptanceCase = (typeof acceptanceCases)[number]

const makeAction = (requirement: string): Action => ({
    key: `bridge-follow-up:${requirement}`,
    kind: 'sumsub',
    purpose: 'document-resubmit',
    requirementKey: requirement,
})

const makeRail = (scenario: AcceptanceCase, method = 'ach'): Rail => {
    const action = makeAction(scenario.requirement)
    const waiting = scenario.verdict === 'wait'
    const terminal = scenario.verdict === 'final'
    const fixable = scenario.verdict === 'fixable'
    return {
        id: `${scenario.provider}.${method}`,
        provider: scenario.provider,
        method,
        channel: 'bank',
        country: 'US',
        currency: 'USD',
        status: scenario.status === 'active' ? 'enabled' : scenario.status,
        resolved: {
            status: waiting ? 'pending' : fixable ? 'fixable' : 'blocked',
            blocking: {
                code: terminal ? 'terminal_rejection' : 'additional_information_required',
                userMessage: 'Additional information required',
                selfHealable: fixable,
                ...(fixable ? { selfHealKind: 'document-resubmit' as const } : {}),
            },
            nextAction: waiting ? { ...action, kind: 'wait' } : action,
        },
    }
}

const capabilitiesFor = (rails: Rail[], actions: Action[] = []) => {
    const nextActions = [
        ...new Map(
            [...actions, ...rails.flatMap((rail) => (rail.resolved?.nextAction ? [rail.resolved.nextAction] : []))].map(
                (action) => [action.key, action]
            )
        ).values(),
    ]
    return withFeatureReport({ rails, nextActions, restrictions: [] })
}
const tasksFor = (rails: Rail[], actions: Action[] = []) => {
    const caps = capabilitiesFor(rails, actions)
    return selectHomeTasks(caps.nextActions, caps.features)
}

describe('Bridge follow-up task acceptance', () => {
    test.each(acceptanceCases)('$name', (scenario) => {
        const rail = makeRail(scenario)
        const result = tasksFor([rail])

        expect(result.largeTasks).toHaveLength(scenario.bridgeTasks)
        expect(result.documentSlide).toBeUndefined()
        if (scenario.bridgeTasks === 1) {
            expect(result.largeTasks[0]).toEqual(
                expect.objectContaining({
                    kind: 'sumsub',
                    requirementKey: scenario.requirement,
                })
            )
            expect(result.largeTasks[0].key).not.toBe(rail.resolved?.nextAction?.key)
            expect(result.largeTasks[0].key).not.toMatch(/^card-document:/)
        }
    })

    test('equivalent Bridge asks produce exactly one blocking task', () => {
        const scenario = acceptanceCases[0]
        const result = tasksFor([makeRail(scenario, 'ach'), makeRail(scenario, 'sepa')])

        expect(result.largeTasks).toHaveLength(1)
        expect(result.largeTasks[0]).toEqual(
            expect.objectContaining({ kind: 'sumsub', requirementKey: scenario.requirement })
        )
        expect(result.documentSlide).toBeUndefined()
    })

    test('Rain card document task remains independent of the blocking Bridge task', () => {
        const rainAction: Action = {
            key: 'sumsub:proof_of_address',
            kind: 'sumsub',
            purpose: 'rain-card',
            levelKey: 'proof_of_address',
        }
        const rainRail: Rail = {
            id: 'rain.card',
            provider: 'rain',
            method: 'CARD',
            channel: 'card',
            country: 'US',
            currency: 'USD',
            status: 'requires-info',
            blockingActions: [rainAction.key],
            resolved: { status: 'fixable', nextAction: rainAction },
        }
        const rainOnly = tasksFor([rainRail], [rainAction])
        const together = tasksFor([rainRail, makeRail(acceptanceCases[1])], [rainAction])

        expect(rainOnly.largeTasks).toHaveLength(1)
        expect(rainOnly.largeTasks[0].key).toBe('card-document:sumsub:proof_of_address')
        expect(rainOnly.documentSlide).toBeUndefined()
        expect(together.documentSlide).toBeUndefined()
        expect(together.largeTasks).toHaveLength(2)
        expect(together.largeTasks).toContainEqual(rainOnly.largeTasks[0])
        const bridgeTask = together.largeTasks.find((task) => task.key !== rainOnly.largeTasks[0].key)
        expect(bridgeTask).toEqual(expect.objectContaining({ kind: 'sumsub', requirementKey: 'proof_of_address' }))
        expect(bridgeTask?.key).not.toBe(rainOnly.largeTasks[0].key)
        expect(bridgeTask?.key).not.toBe(rainAction.key)
    })
})

export { acceptanceCases }
