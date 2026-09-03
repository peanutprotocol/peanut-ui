import { installPasskeyVerifyCapture } from '../native-auth-capture'
import { stashCeremonyStepUpToken, stashCeremonyVerifyToken } from '@/utils/passkeyCeremony.utils'
import { isCapacitor } from '@/utils/capacitor'

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => false) }))
jest.mock('@/utils/sentry-lazy', () => ({ withScope: jest.fn(), captureMessage: jest.fn() }))
jest.mock('@/utils/passkeyCeremony.utils', () => ({
    currentCeremonyId: () => 7,
    stashCeremonyVerifyToken: jest.fn(),
    stashCeremonyStepUpToken: jest.fn(),
}))

const mockIsCapacitor = isCapacitor as jest.Mock

// jsdom has no Response; the wrapper only touches ok/clone/json/text.
function jsonResponse(body: unknown): Response {
    const response = {
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
        clone: () => response,
    }
    return response as unknown as Response
}

describe('installPasskeyVerifyCapture', () => {
    const verifyBody = { verification: { verified: true }, token: 'jwt', stepUpToken: 'proof', stepUpExpiresIn: 300 }

    beforeAll(() => {
        window.fetch = jest.fn(async () => jsonResponse(verifyBody))
        installPasskeyVerifyCapture()
    })

    beforeEach(() => {
        jest.clearAllMocks()
        mockIsCapacitor.mockReturnValue(false)
    })

    it('web: stashes the login-minted step-up proof but leaves the session token to the cookie', async () => {
        await window.fetch('/passkeys/login/verify', { method: 'POST' })
        expect(stashCeremonyStepUpToken).toHaveBeenCalledWith('proof', 300, 7)
        expect(stashCeremonyVerifyToken).not.toHaveBeenCalled()
    })

    it('native: stashes both', async () => {
        mockIsCapacitor.mockReturnValue(true)
        await window.fetch('https://api.peanut.me/passkeys/login/verify', { method: 'POST' })
        expect(stashCeremonyVerifyToken).toHaveBeenCalledWith('jwt', 7)
        expect(stashCeremonyStepUpToken).toHaveBeenCalledWith('proof', 300, 7)
    })

    it('ignores non-passkey requests', async () => {
        await window.fetch('/users/me')
        expect(stashCeremonyStepUpToken).not.toHaveBeenCalled()
    })
})
