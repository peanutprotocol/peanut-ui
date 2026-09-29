/**
 * Runs against the real Cordova wrapper (only `cordova/exec`, the native
 * bridge, is faked), because the defect lives in the wrapper: its launch
 * callback clears the module-level instance reference unconditionally.
 */
type ExecCall = { action: string; success: (result: unknown) => void }
const execCalls: ExecCall[] = []
jest.mock(
    'cordova/exec',
    () => (success: (result: unknown) => void, _error: unknown, _service: string, action: string) =>
        execCalls.push({ action, success }),
    { virtual: true }
)

type SumsubModule = NonNullable<Window['SNSMobileSDK']>

const loadWrapper = (): SumsubModule => {
    let wrapper: SumsubModule | undefined
    jest.isolateModules(() => {
        wrapper = require('@sumsub/cordova-idensic-mobile-sdk-plugin/dist/SNSMobileSDK.js')
    })
    return wrapper!
}

const build = (sumsub: SumsubModule, onStatusChanged: jest.Mock, tokenHandler: jest.Mock) =>
    sumsub.init('tok', tokenHandler).withHandlers({ onStatusChanged }).build()

// Session A was orphaned (reset releases the lock), session B launched, then
// A's native callback arrives late.
const orphanThenRelaunch = (sumsub: SumsubModule) => {
    const a = { status: jest.fn(), token: jest.fn().mockResolvedValue('tok_a') }
    const b = { status: jest.fn(), token: jest.fn().mockResolvedValue('tok_b') }
    const instanceA = build(sumsub, a.status, a.token)
    void instanceA.launch()
    const lateCallbackA = execCalls[execCalls.length - 1].success
    sumsub.reset!()
    const instanceB = build(sumsub, b.status, b.token)
    return { a, b, instanceA, instanceB, lateCallbackA }
}

describe('sumsubNativeSession', () => {
    beforeEach(() => {
        execCalls.length = 0
    })

    it('reproduces the wrapper defect: a late callback drops the new session events', () => {
        const sumsub = loadWrapper()
        const { b, instanceB, lateCallbackA } = orphanThenRelaunch(sumsub)
        void instanceB.launch()

        lateCallbackA({ success: true, status: 'Initial' })
        sumsub.sendEvent!('onStatusChanged', { newStatus: 'Pending' })
        sumsub.getNewAccessToken!()

        expect(b.status).not.toHaveBeenCalled()
        expect(b.token).not.toHaveBeenCalled()
    })

    it('routes events and token refreshes to the active session after a late callback', async () => {
        const { setActiveSumsubInstance } = await import('../sumsubNativeSession.utils')
        const sumsub = loadWrapper()
        const { a, b, instanceB, lateCallbackA } = orphanThenRelaunch(sumsub)
        setActiveSumsubInstance(sumsub, instanceB)
        void instanceB.launch()

        lateCallbackA({ success: true, status: 'Initial' })
        sumsub.sendEvent!('onStatusChanged', { newStatus: 'Pending' })
        sumsub.getNewAccessToken!()

        expect(b.status).toHaveBeenCalledWith({ newStatus: 'Pending' })
        expect(b.token).toHaveBeenCalledTimes(1)
        expect(a.status).not.toHaveBeenCalled()
        expect(a.token).not.toHaveBeenCalled()
    })

    it('drops events once the session that owns the route is cleared', async () => {
        const { clearActiveSumsubInstance, setActiveSumsubInstance } = await import('../sumsubNativeSession.utils')
        const sumsub = loadWrapper()
        const { a, b, instanceA, instanceB } = orphanThenRelaunch(sumsub)
        setActiveSumsubInstance(sumsub, instanceB)

        // a stale session clearing does not remove the newer route
        clearActiveSumsubInstance(instanceA)
        sumsub.sendEvent!('onStatusChanged', { newStatus: 'Pending' })
        expect(b.status).toHaveBeenCalledTimes(1)

        clearActiveSumsubInstance(instanceB)
        sumsub.sendEvent!('onStatusChanged', { newStatus: 'Approved' })
        expect(b.status).toHaveBeenCalledTimes(1)
        expect(a.status).not.toHaveBeenCalled()
    })
})
