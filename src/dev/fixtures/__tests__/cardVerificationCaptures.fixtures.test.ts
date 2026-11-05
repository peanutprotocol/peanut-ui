/** @jest-environment node */
import { answer } from '../../../../scripts/screens/adapter'
import { FIXTURES } from '@/dev/fixtures/registry'
import { SCREENS } from '@/dev/screens/catalogue'

describe('issued-card verification capture fixtures', () => {
    it.each(['open', 'checking', 'unavailable'] as const)(
        '%s exposes the actual card route and its corresponding overview state',
        async (state) => {
            const name = `card-verification-${state}`
            expect(FIXTURES[name].route).toBe('/card')
            const screen = SCREENS.find((entry) => entry.fixture === name && entry.route === '/card')
            expect(screen?.expectSelector).toBe(
                state === 'open' ? '[data-testid="card-verification-continue"]' : '[data-testid="your-card-screen"]'
            )
            const response = await answer(name, '/rain/cards', 'GET')
            const overview = await response.json()
            expect(overview.cards[0].status).toBe('ACTIVE')
            expect(overview.verificationContext.status).toBe(state)
            if (state === 'open') {
                expect(overview.pendingVerification).toMatchObject({ kind: 'card_addon' })
                expect(overview.pendingVerification.generation).toBe(overview.verificationContext.generation)
                expect(overview.pendingVerification.entryScope).toBe(overview.verificationContext.entryScope)
            } else {
                expect(overview.pendingVerification).toBeUndefined()
            }
        }
    )
})
