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
})
