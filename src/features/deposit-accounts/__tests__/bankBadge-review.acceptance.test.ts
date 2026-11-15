/** Badge and actual destination must agree; adapter renders the real UI. */
import { bankScenario } from './review-acceptance-adapter'

describe('bank badge actionable-gate precedence', () => {
    test.each([undefined, 'endorsement-pending'])(
        'fixable rejection remains actionable with blocker %s',
        async (blockedBy) => {
            const state = await bankScenario({ gateKind: 'fixable-rejection', blockedBy, identityVerified: true })
            expect(state).toMatchObject({ badge: 'action-needed', destination: 'action' })
        }
    )
    test.each(['pending', 'ready'])(
        '%s without actionable gate uses review status for endorsement pending',
        async (gateKind) => {
            const state = await bankScenario({ gateKind, blockedBy: 'endorsement-pending', identityVerified: true })
            expect(state).toMatchObject({ badge: 'under-review', destination: 'review' })
        }
    )
})
