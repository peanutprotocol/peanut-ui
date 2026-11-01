import { DEFAULT_KILL_SWITCHES } from '../kill-switches.consts'
import type { KillSwitches } from '../kill-switches.types'
import { maintenanceRedirectTarget, resolveKillSwitches } from '../kill-switches.utils'

describe('resolveKillSwitches', () => {
    it('retains every release switch with the KYC and Brazil pauses defaulting off', () => {
        expect(Object.keys(DEFAULT_KILL_SWITCHES).sort()).toEqual(
            [
                'enableFullMaintenance',
                'enableMaintenanceBanner',
                'maintenanceBannerPaths',
                'disabledPaymentProviders',
                'disabledMantecaCurrencies',
                'disableXchainWithdraw',
                'disableXchainSend',
                'pixBrazilOnrampMaintenance',
                'kycVerificationDown',
                'brazilServicesPaused',
            ].sort()
        )
        expect(DEFAULT_KILL_SWITCHES).toEqual(
            expect.objectContaining({ kycVerificationDown: false, brazilServicesPaused: false })
        )
    })

    const pauseKeys: (keyof KillSwitches)[] = ['kycVerificationDown', 'brazilServicesPaused']
    it.each(pauseKeys)('resolves %s independently and rejects malformed values', (key) => {
        expect(resolveKillSwitches({ [key]: true }, { [key]: false })[key]).toBe(true)
        expect(resolveKillSwitches({ [key]: false }, { [key]: true })[key]).toBe(false)
        expect(resolveKillSwitches({ [key]: 'true' }, { [key]: true })[key]).toBe(true)
        expect(resolveKillSwitches({ [key]: 'true' }, { [key]: 1 })[key]).toBe(false)
    })

    it('keeps the KYC and Brazil pauses independent', () => {
        expect(resolveKillSwitches({ kycVerificationDown: false, brazilServicesPaused: true }, null)).toEqual({
            ...DEFAULT_KILL_SWITCHES,
            kycVerificationDown: false,
            brazilServicesPaused: true,
        })
        expect(resolveKillSwitches({ kycVerificationDown: true, brazilServicesPaused: false }, null)).toEqual({
            ...DEFAULT_KILL_SWITCHES,
            kycVerificationDown: true,
            brazilServicesPaused: false,
        })
    })

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
        expect(maintenanceRedirectTarget(path, true, false, false)).toBe('/maintenance')
    })

    it.each(['/', '/maintenance', '/support', '/maintenance/', '/support/'])('leaves %s open when it is on', (path) => {
        expect(maintenanceRedirectTarget(path, true, false, true)).toBeNull()
    })

    it('never redirects other pages when it is off', () => {
        expect(maintenanceRedirectTarget('/home', false, false, true)).toBeNull()
    })

    it.each(['/maintenance', '/maintenance/'])('sends %s back to /home once the API says it is off', (path) => {
        expect(maintenanceRedirectTarget(path, false, false, true)).toBe('/home')
    })

    it('stays on /maintenance while "off" is only a default or saved value', () => {
        expect(maintenanceRedirectTarget('/maintenance', false, false, false)).toBeNull()
    })

    it('does not redirect to /maintenance in demo mode', () => {
        expect(maintenanceRedirectTarget('/home', true, true, false)).toBeNull()
    })

    it('never redirects away from /maintenance in demo mode', () => {
        expect(maintenanceRedirectTarget('/maintenance', true, true, false)).toBeNull()
        expect(maintenanceRedirectTarget('/maintenance', false, true, true)).toBeNull()
    })
})
