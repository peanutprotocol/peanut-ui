/**
 * The cache is the risky part: too eager and one Face ID prompt unlocks
 * sensitive routes indefinitely, too shy and a withdrawal prompts twice.
 */
import { clearStepUpToken, getStepUpToken, primeStepUpToken, STEP_UP_HEADER, withStepUpHeader } from '../step-up'
import { apiFetch } from '@/utils/api-fetch'
import { startAuthentication } from '@simplewebauthn/browser'
import { CeremonyTimeoutError, guardPasskeyCeremony } from '@/utils/passkeyCeremony.utils'
import { withCeremonyPurpose } from '@/utils/webauthn-ceremony-telemetry'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({
    withCeremonyPurpose: jest.fn((_purpose: string, fn: () => Promise<unknown>) => fn()),
}))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false, getNativeRpId: () => 'peanut.me' }))
// passthrough spy — the suite asserts the ceremony is routed through the guard
// (shim gate + timeout, TASK-21782) without changing its behavior
jest.mock('@/utils/passkeyCeremony.utils', () => {
    const actual = jest.requireActual('@/utils/passkeyCeremony.utils')
    return { ...actual, guardPasskeyCeremony: jest.fn(actual.guardPasskeyCeremony) }
})

const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>
const mockedAuth = startAuthentication as jest.MockedFunction<typeof startAuthentication>
const mockedGuard = guardPasskeyCeremony as jest.MockedFunction<typeof guardPasskeyCeremony>

function jsonResponse(body: unknown, ok = true, status = 200) {
    return { ok, status, json: async () => body } as Response
}

function happyPath(token = 'proof-token', expiresIn = 300) {
    mockedFetch.mockReset()
    mockedFetch
        .mockResolvedValueOnce(jsonResponse({ challenge: 'abc' }))
        .mockResolvedValueOnce(jsonResponse({ token, expiresIn }))
}

describe('getStepUpToken', () => {
    beforeEach(() => {
        clearStepUpToken()
        mockedAuth.mockReset()
        mockedAuth.mockResolvedValue({ id: 'cred' } as never)
    })

    it('runs the ceremony and returns the proof token', async () => {
        happyPath()
        await expect(getStepUpToken()).resolves.toBe('proof-token')
        expect(mockedFetch).toHaveBeenCalledTimes(2)
        expect(mockedFetch.mock.calls[0][0]).toBe('/auth/step-up/options')
        expect(mockedFetch.mock.calls[1][0]).toBe('/auth/step-up/verify')
    })

    it('reuses a live proof instead of prompting again', async () => {
        happyPath()
        await getStepUpToken()
        await expect(getStepUpToken()).resolves.toBe('proof-token')
        expect(mockedAuth).toHaveBeenCalledTimes(1)
    })

    it('re-prompts once the proof is close enough to expiry to be unusable', async () => {
        happyPath('first', 20) // inside the 30s safety margin
        await getStepUpToken()
        happyPath('second')
        await expect(getStepUpToken()).resolves.toBe('second')
        expect(mockedAuth).toHaveBeenCalledTimes(2)
    })

    it('re-prompts after the cache is cleared (logout)', async () => {
        happyPath('first')
        await getStepUpToken()
        clearStepUpToken()
        happyPath('second')
        await expect(getStepUpToken()).resolves.toBe('second')
    })

    it('explains the failure when the account has no passkey', async () => {
        mockedFetch.mockReset()
        mockedFetch.mockResolvedValueOnce(jsonResponse({ error: 'none' }, false, 404))
        await expect(getStepUpToken()).rejects.toThrow('No passkey is registered')
    })

    it('does not cache a proof when verification is rejected', async () => {
        mockedFetch.mockReset()
        mockedFetch
            .mockResolvedValueOnce(jsonResponse({ challenge: 'abc' }))
            .mockResolvedValueOnce(jsonResponse({ error: 'nope' }, false, 401))
        await expect(getStepUpToken()).rejects.toThrow('Could not confirm it is you')

        happyPath('after-retry')
        await expect(getStepUpToken()).resolves.toBe('after-retry')
    })

    it('propagates a cancelled prompt rather than proceeding unverified', async () => {
        mockedFetch.mockReset()
        mockedFetch.mockResolvedValueOnce(jsonResponse({ challenge: 'abc' }))
        mockedAuth.mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }))
        await expect(getStepUpToken()).rejects.toThrow('cancelled')
    })

    it('runs the WebAuthn ceremony inside the passkey ceremony guard', async () => {
        happyPath()
        mockedGuard.mockClear()
        await getStepUpToken()
        expect(mockedGuard).toHaveBeenCalledTimes(1)
    })

    it('surfaces a ceremony guard failure as a StepUpError with curated copy', async () => {
        mockedFetch.mockReset()
        mockedFetch.mockResolvedValueOnce(jsonResponse({ challenge: 'abc' }))
        mockedAuth.mockRejectedValueOnce(new CeremonyTimeoutError(60_000))

        const failure = getStepUpToken()
        await expect(failure).rejects.toThrow(/taking longer/i)
        await expect(failure).rejects.toMatchObject({ name: 'StepUpError' })
    })
})

describe('withStepUpHeader', () => {
    beforeEach(() => {
        clearStepUpToken()
        mockedAuth.mockReset()
        mockedAuth.mockResolvedValue({ id: 'cred' } as never)
    })

    it('adds the proof header while preserving existing ones', async () => {
        happyPath()
        await expect(withStepUpHeader({ 'Content-Type': 'application/json' })).resolves.toEqual({
            'Content-Type': 'application/json',
            [STEP_UP_HEADER]: 'proof-token',
        })
    })
})

describe('ceremony telemetry', () => {
    it('tags the assertion as step_up so it stops showing as unknown', async () => {
        clearStepUpToken()
        mockedAuth.mockResolvedValue({ id: 'cred' } as never)
        happyPath()
        await getStepUpToken()
        expect(withCeremonyPurpose).toHaveBeenCalledWith('step_up', expect.any(Function))
    })
})

describe('primeStepUpToken', () => {
    it('serves a login-minted proof without a second ceremony until it expires', async () => {
        clearStepUpToken()
        mockedFetch.mockReset()
        mockedAuth.mockReset()
        primeStepUpToken('from-login', 300)
        await expect(getStepUpToken()).resolves.toBe('from-login')
        expect(mockedAuth).not.toHaveBeenCalled()
        expect(mockedFetch).not.toHaveBeenCalled()
    })

    it('ignores a primed proof inside the expiry margin', async () => {
        clearStepUpToken()
        mockedAuth.mockResolvedValue({ id: 'cred' } as never)
        primeStepUpToken('almost-dead', 10)
        happyPath('fresh')
        await expect(getStepUpToken()).resolves.toBe('fresh')
        expect(mockedAuth).toHaveBeenCalledTimes(1)
    })
})
