import { checkAndroidLandingPasskey } from '../landing-passkeys'
import { isAndroidNative, isNativeBridge } from '../capacitor'

const mockCheck = jest.fn()

jest.mock('@capacitor/core', () => ({
    registerPlugin: jest.fn(() =>
        jest
            .requireActual('../__mocks__/capacitor-plugin-proxy')
            .createPluginProxy({ check: (...args: unknown[]) => mockCheck(...args) }, 'PasskeyAvailability')
    ),
}))
jest.mock('../capacitor', () => ({
    getNativeRpId: () => 'peanut.me',
    isAndroidNative: jest.fn(() => true),
    isIOSNative: () => false,
    isNativeBridge: jest.fn(() => true),
}))

beforeEach(() => {
    mockCheck.mockReset()
    jest.mocked(isAndroidNative).mockReturnValue(true)
    jest.mocked(isNativeBridge).mockReturnValue(true)
})

it.each(['available', 'unavailable', 'unknown'])(
    'returns the native %s answer using the native RP ID',
    async (availability) => {
        mockCheck.mockResolvedValue({ availability })
        await expect(checkAndroidLandingPasskey(new AbortController().signal)).resolves.toBe(availability)
        expect(mockCheck).toHaveBeenCalledWith({ rpId: 'peanut.me' })
    }
)

it.each([undefined, null, {}, { availability: 'invalid' }, { availability: true }])(
    'normalizes malformed native result %p to unknown',
    async (response) => {
        mockCheck.mockResolvedValue(response)
        await expect(checkAndroidLandingPasskey(new AbortController().signal)).resolves.toBe('unknown')
    }
)

it.each(['plugin missing', 'permission denied', 'provider failure'])('returns unknown for %s', async (message) => {
    mockCheck.mockRejectedValue(new Error(message))
    await expect(checkAndroidLandingPasskey(new AbortController().signal)).resolves.toBe('unknown')
})

it('does not call native when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(checkAndroidLandingPasskey(controller.signal)).resolves.toBe('unknown')
    expect(mockCheck).not.toHaveBeenCalled()
})

it('ignores an answer received after abort', async () => {
    let answer: ((result: { availability: string }) => void) | undefined
    mockCheck.mockReturnValue(
        new Promise((resolve) => {
            answer = resolve
        })
    )
    const controller = new AbortController()
    const check = checkAndroidLandingPasskey(controller.signal)
    controller.abort()
    answer?.({ availability: 'available' })
    await expect(check).resolves.toBe('unknown')
})

it.each(['web', 'ios'])('never calls the Android plugin on %s', async (platform) => {
    jest.mocked(isAndroidNative).mockReturnValue(false)
    jest.mocked(isNativeBridge).mockReturnValue(platform === 'ios')
    await expect(checkAndroidLandingPasskey(new AbortController().signal)).resolves.toBe('unknown')
    expect(mockCheck).not.toHaveBeenCalled()
})
