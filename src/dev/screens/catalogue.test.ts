import { FIXTURES } from '../fixtures/registry'
import { SCREENS } from './catalogue'

describe('screen catalogue', () => {
    it('keeps destination screens without listing routing aliases or obsolete routes', () => {
        const ids = new Set(SCREENS.map(({ id }) => id))

        expect(
            [
                'p21-qr',
                'p30-points',
                'p45-card-payment',
                'p48-points-invites',
                'p49-request-pay',
                'p54-pay-recipient',
                'p66-bank-local',
                'h01-notifications',
                'h02-settings',
                'fixture-setup-pending',
                'p50-setup-session',
                'p51-setup-finish',
            ].filter((id) => ids.has(id))
        ).toEqual([])
        expect(
            [
                'qr-camera-permission',
                '54-d-qrbottomdrawer',
                'fixture-rewards',
                'fixture-rewards-invites',
                'p22-card',
                'p47-pay-request',
                'p55-send-recipient',
                'p69-regional-deposit',
                '20-a-setupnotificationsmodal',
                'p06-profile',
                'p34-language',
            ].filter((id) => !ids.has(id))
        ).toEqual([])
    })

    it('keeps setup screens in their flow regardless of journey order and rewards invites in Rewards', () => {
        const setupIds = SCREENS.filter(({ flow }) => flow === 'Setup and login').map(({ id }) => id)
        expect(setupIds).toEqual(
            expect.arrayContaining([
                '01-a-landing',
                '06-b-invite',
                '06-a-signup',
                '08-a-passkeysetuphelpmodal',
                '03-a-residence-select',
                '03-b-residence-compare',
                '04-b-advantage-fees',
                '02-b-advantage-card',
                '03-c-residence-congrats',
                '03-h-funding-methods',
                '03-i-payment-methods',
                '07-c-notification-email',
                '07-d-notification-settings',
                '07-b-advantage-control',
                '05-a-signtesttransaction',
                '07-e-setup-celebration',
                '20-a-setupnotificationsmodal',
            ])
        )
        expect(SCREENS.find(({ id }) => id === 'fixture-rewards-invites')?.flow).toBe('Rewards')
    })

    it('sorts screens by their configured order; a flag variant shares the order of the screen it follows', () => {
        expect(
            SCREENS.every(
                (screen, index) =>
                    index === 0 ||
                    SCREENS[index - 1].order < screen.order ||
                    (screen.flags !== undefined && SCREENS[index - 1].order === screen.order)
            )
        ).toBe(true)
    })

    it('keeps the locale-independent trigger for the request bank chooser', () => {
        expect(SCREENS.find(({ id }) => id === '88-f-request-bank-currency')?.clickTestIds).toEqual([
            'bank-transfer-chooser',
        ])
    })

    it('opens the Brazilian resident details drawers by test id', () => {
        const clickTestIds = (id: string) => SCREENS.find((screen) => screen.id === id)?.clickTestIds
        expect(clickTestIds('profile-brazil-bank-details')).toEqual(['bank-row-brl'])
        expect(clickTestIds('profile-brazil-qr-details')).toEqual(['method-row-qr-pay'])
    })

    it('waits for the open drawer title, never the first dialog on the page', () => {
        for (const [id, title] of [
            ['profile-brazil-bank-details', 'closed-row-title'],
            ['profile-brazil-qr-details', 'payment-method-details-title'],
        ]) {
            expect(SCREENS.find((screen) => screen.id === id)?.expectSelector).toBe(
                `[role="dialog"][data-state="open"] [data-testid="${title}"]`
            )
        }
    })

    it('derives every fixture capture from the fixture, including states without checkpoints', () => {
        const byId = new Map(SCREENS.map((screen) => [screen.id, screen]))
        for (const [id, fixture] of Object.entries(FIXTURES)) {
            const screen = byId.get(`fixture-${id}`)
            expect(screen).toBeDefined()
            expect(screen?.actions).toEqual(fixture.capture?.actions)
            expect(screen?.expectSelector).toEqual(fixture.capture?.expectSelector)
            expect(screen?.waitFor).toBe(fixture.waitFor)
        }
    })

    it('uses app-owned controls and checkpoints without locale-specific copy', () => {
        for (const screen of SCREENS) {
            expect(screen.clicks).toEqual([])
            expect(screen.expectText).toBeUndefined()
            for (const action of screen.actions ?? []) {
                expect(action).not.toHaveProperty('click')
                expect(action).not.toHaveProperty('tap')
            }
        }
    })
})
