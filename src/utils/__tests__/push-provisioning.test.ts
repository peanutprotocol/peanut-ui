// getPushProvisioningAvailability gates the native add-to-wallet row: real
// answer on native binaries with the MeaWallet SDK, silently unavailable on
// web and on older binaries running OTA'd JS (plugin call throws) — those must
// keep the manual carousel, never surface an error.
import { addCardToWallet, getPushProvisioningAvailability } from '../push-provisioning'
import { isAndroidNative, isIOSNative } from '../capacitor'

const isAvailable = jest.fn()
const addCard = jest.fn()

jest.mock('@capacitor/core', () => ({
    registerPlugin: jest.fn(() => ({
        isAvailable: (o: unknown) => isAvailable(o),
        addCard: (o: unknown) => addCard(o),
    })),
}))

jest.mock('../capacitor', () => ({
    isIOSNative: jest.fn(() => false),
    isAndroidNative: jest.fn(() => false),
}))

const mockIsIOSNative = isIOSNative as jest.MockedFunction<typeof isIOSNative>
const mockIsAndroidNative = isAndroidNative as jest.MockedFunction<typeof isAndroidNative>

describe('getPushProvisioningAvailability', () => {
    beforeEach(() => {
        // clearAllMocks keeps implementations — reset the platform answers
        // explicitly so one test's mockReturnValue can't leak into the next.
        jest.clearAllMocks()
        mockIsIOSNative.mockReturnValue(false)
        mockIsAndroidNative.mockReturnValue(false)
    })

    it('is unavailable on web without touching the plugin', async () => {
        await expect(getPushProvisioningAvailability('1234')).resolves.toEqual({
            available: false,
            alreadyInWallet: false,
        })
        expect(isAvailable).not.toHaveBeenCalled()
    })

    it('returns the native answer on iOS', async () => {
        mockIsIOSNative.mockReturnValue(true)
        isAvailable.mockResolvedValue({ available: true, alreadyInWallet: false })
        await expect(getPushProvisioningAvailability('1234')).resolves.toEqual({
            available: true,
            alreadyInWallet: false,
        })
        expect(isAvailable).toHaveBeenCalledWith({ last4: '1234' })
    })

    it('degrades to unavailable when the plugin is missing (older binary OTA)', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        isAvailable.mockRejectedValue(new Error('"PushProvisioning" plugin is not implemented on android'))
        await expect(getPushProvisioningAvailability('1234')).resolves.toEqual({
            available: false,
            alreadyInWallet: false,
        })
    })
})

describe('addCardToWallet', () => {
    beforeEach(() => {
        // Both platform answers reset AND a supported one enabled explicitly:
        // clearAllMocks keeps mockReturnValue, so these tests used to pass only
        // because the availability suite above happened to leave Android true.
        // Run alone, each took the unsupported-platform fallback and never
        // reached addCard at all.
        jest.clearAllMocks()
        mockIsIOSNative.mockReturnValue(false)
        mockIsAndroidNative.mockReturnValue(true)
    })

    it('passes through the native result', async () => {
        addCard.mockResolvedValue({ added: true, last4: '1234' })
        await expect(addCardToWallet({ cardId: 'c', cardSecret: 's' })).resolves.toEqual({
            added: true,
            last4: '1234',
        })
        expect(addCard).toHaveBeenCalled()
    })

    it('never throws — plugin errors come back as { added: false, error }', async () => {
        addCard.mockRejectedValue(new Error('boom'))
        await expect(addCardToWallet({ cardId: 'c', cardSecret: 's' })).resolves.toEqual({
            added: false,
            error: 'boom',
        })
        expect(addCard).toHaveBeenCalled()
    })

    it('is unavailable on web without touching the plugin', async () => {
        mockIsAndroidNative.mockReturnValue(false)

        await expect(addCardToWallet({ cardId: 'c', cardSecret: 's' })).resolves.toEqual({
            added: false,
            error: 'PushProvisioning is not available on this platform',
        })
        expect(addCard).not.toHaveBeenCalled()
    })
})
