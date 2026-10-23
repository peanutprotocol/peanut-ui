import { DEFAULT_KILL_SWITCHES } from '../kill-switches.consts'
import { maintenanceRedirectTarget, resolveKillSwitches } from '../kill-switches.utils'

describe('resolveKillSwitches', () => {
    it('uses the built-in defaults when nothing is served or saved', () => {
        expect(resolveKillSwitches(null, null)).toEqual(DEFAULT_KILL_SWITCHES)
    })

    it('takes each key from the server, else the saved values, else the default', () => {
        const result = resolveKillSwitches(
            { enableMaintenanceBanner: true },
            { enableMaintenanceBanner: false, disableXchainSend: false, disabledMantecaCurrencies: ['BRL'] }
        )
        expect(result).toEqual({
            ...DEFAULT_KILL_SWITCHES,
            enableMaintenanceBanner: true, // server beats saved
            disableXchainSend: false, // saved beats default (true)
            disabledMantecaCurrencies: ['BRL'],
        })
    })

    it('ignores a server or saved value of the wrong type, per key', () => {
        const result = resolveKillSwitches(
            { enableFullMaintenance: 'true', maintenanceBannerPaths: '/withdraw', disableXchainWithdraw: true },
            { enableFullMaintenance: true, disabledPaymentProviders: [1], disableXchainSend: null }
        )
        expect(result).toEqual({
            ...DEFAULT_KILL_SWITCHES,
            enableFullMaintenance: true, // bad server string falls back to the valid saved value
            disableXchainWithdraw: true,
        })
    })

    it('ignores unknown keys and responses that are not objects', () => {
        expect(resolveKillSwitches({ somethingElse: true }, ['enableFullMaintenance'])).toEqual(DEFAULT_KILL_SWITCHES)
        expect(resolveKillSwitches('oops', 42)).toEqual(DEFAULT_KILL_SWITCHES)
    })
})

describe('maintenanceRedirectTarget', () => {
    it.each(['/home', '/withdraw/manteca', '/send/', '/claim'])('sends %s to /maintenance when it is on', (path) => {
        expect(maintenanceRedirectTarget(path, true, false)).toBe('/maintenance')
    })

    it.each(['/', '/maintenance', '/support', '/maintenance/', '/support/'])('leaves %s open when it is on', (path) => {
        expect(maintenanceRedirectTarget(path, true, false)).toBeNull()
    })

    it('never redirects other pages when it is off', () => {
        expect(maintenanceRedirectTarget('/home', false, false)).toBeNull()
    })

    it.each(['/maintenance', '/maintenance/'])('sends %s back to /home when it is off', (path) => {
        expect(maintenanceRedirectTarget(path, false, false)).toBe('/home')
    })

    it('does not redirect to /maintenance in demo mode', () => {
        expect(maintenanceRedirectTarget('/home', true, true)).toBeNull()
    })

    it('lets demo mode leave /maintenance instead of looping back to it', () => {
        expect(maintenanceRedirectTarget('/maintenance', true, true)).toBe('/home')
        expect(maintenanceRedirectTarget('/home', true, true)).toBeNull()
    })
})
