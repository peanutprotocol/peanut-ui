const mockIsFeatureFlagEnabled = jest.fn<boolean, [string]>()
jest.mock('@/utils/featureFlag.utils', () => ({
    isFeatureFlagEnabled: (key: string) => mockIsFeatureFlagEnabled(key),
}))

type Gate = typeof import('../session-key-spend.consts')

function loadGate(buildEnv: string | undefined): Gate {
    let mod: Gate | undefined
    jest.isolateModules(() => {
        if (buildEnv === undefined) delete process.env.NEXT_PUBLIC_SESSION_KEY_SPEND
        else process.env.NEXT_PUBLIC_SESSION_KEY_SPEND = buildEnv
        mod = require('../session-key-spend.consts')
    })
    return mod!
}

describe('sessionKeySpendEnabled', () => {
    beforeEach(() => {
        window.localStorage.clear()
        mockIsFeatureFlagEnabled.mockReset().mockReturnValue(false)
    })

    it('is off when the build gate is off, whatever the runtime says', () => {
        const gate = loadGate(undefined)
        mockIsFeatureFlagEnabled.mockReturnValue(true)
        gate.setSessionKeySpendDeviceOptIn(true)
        expect(gate.SESSION_KEY_SPEND_BUILD_ENABLED).toBe(false)
        expect(gate.sessionKeySpendEnabled()).toBe(false)
    })

    it('is off with the build gate on but neither runtime gate', () => {
        const gate = loadGate('true')
        expect(gate.sessionKeySpendEnabled()).toBe(false)
        expect(mockIsFeatureFlagEnabled).toHaveBeenCalledWith('session_key_spend')
    })

    it('turns on from the PostHog flag', () => {
        const gate = loadGate('true')
        mockIsFeatureFlagEnabled.mockReturnValue(true)
        expect(gate.sessionKeySpendEnabled()).toBe(true)
    })

    it('turns on from the device opt-in without consulting the flag', () => {
        const gate = loadGate('true')
        gate.setSessionKeySpendDeviceOptIn(true)
        expect(gate.sessionKeySpendEnabled()).toBe(true)
        expect(mockIsFeatureFlagEnabled).not.toHaveBeenCalled()
        gate.setSessionKeySpendDeviceOptIn(false)
        expect(gate.sessionKeySpendEnabled()).toBe(false)
    })

    it('treats an unreadable localStorage as no opt-in', () => {
        const gate = loadGate('true')
        const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError')
        })
        expect(gate.sessionKeySpendDeviceOptIn()).toBe(false)
        expect(gate.sessionKeySpendEnabled()).toBe(false)
        spy.mockRestore()
    })
})
