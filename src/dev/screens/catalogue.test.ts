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

    it('orders setup screens by their product journey and keeps rewards invites in Rewards', () => {
        const setupIds = SCREENS.filter(({ flow }) => flow === 'Setup and login').map(({ id }) => id)
        expect(setupIds.slice(0, 8)).toEqual([
            '01-a-landing',
            '06-a-signup',
            '03-a-residence-select',
            '07-a-setuppasskey',
            '08-a-passkeysetuphelpmodal',
            '09-a-passkeyinfomodal',
            '05-a-signtesttransaction',
            '20-a-setupnotificationsmodal',
        ])
        expect(SCREENS.find(({ id }) => id === 'fixture-rewards-invites')?.flow).toBe('Rewards')
        expect(SCREENS.every((screen, index) => index === 0 || SCREENS[index - 1].order < screen.order)).toBe(true)
    })
})
