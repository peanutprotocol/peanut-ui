import {
    bindSignupDraft,
    recordSignupRegistration,
    readSignupDraft,
    restoreSignupDraft,
    saveSignupDraft,
    type SignupDraft,
} from '../signup-draft'
import { __resetSignupSavesForTests, flushPendingSignupAnswers } from '../saveSignupAnswers'
import { getUsernameHoldToken } from '../username-reservation'

let mockNative = false
const mockPreferences = new Map<string, string>()
const mockUpdate = jest.fn()
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: () => false,
    isNativeBridge: () => mockNative,
}))
jest.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: async ({ key }: { key: string }) => ({ value: mockPreferences.get(key) ?? null }),
        set: async ({ key, value }: { key: string; value: string }) => {
            mockPreferences.set(key, value)
        },
        remove: async ({ key }: { key: string }) => {
            mockPreferences.delete(key)
        },
    },
}))
jest.mock('@/app/actions/users', () => ({ updateUserById: (...args: unknown[]) => mockUpdate(...args) }))

const KEY = 'peanut:signupDraft:v2'
const snapshot = (): Pick<SignupDraft, 'screenId' | 'answers' | 'featureScreenIds'> => ({
    screenId: 'passkey',
    featureScreenIds: ['advantage-fees', 'advantage-card'],
    answers: {
        username: 'kimchi',
        inviteSelection: 'alice',
        residenceCountry: 'AR',
        nationalityCountry: 'BR',
        fundingChannel: 'arsBank',
        paymentChannel: 'qr',
        notificationChoices: null,
        inviterAccepted: false,
        sellScreensCountry: 'AR',
    },
})
beforeEach(() => {
    localStorage.clear()
    mockPreferences.clear()
    mockNative = false
    mockUpdate.mockReset().mockResolvedValue({ error: 'offline' })
    __resetSignupSavesForTests()
})

it('restores the native draft and install token after WebView storage disappears', async () => {
    mockNative = true
    saveSignupDraft(snapshot())
    const token = await getUsernameHoldToken()
    await restoreSignupDraft()
    localStorage.clear()
    expect(await restoreSignupDraft()).toMatchObject(snapshot())
    expect(await getUsernameHoldToken()).toBe(token)
})

it('never binds or flushes one registrant’s draft into another account', async () => {
    saveSignupDraft(snapshot())
    await bindSignupDraft('registrant')
    await flushPendingSignupAnswers('registrant')
    mockUpdate.mockClear()
    await bindSignupDraft('other-account')
    await flushPendingSignupAnswers('other-account')
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(readSignupDraft()?.userId).toBe('registrant')
})

it('recovers a crash after ownership was persisted but before answers were queued', async () => {
    saveSignupDraft(snapshot())
    localStorage.setItem(KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(KEY)!), userId: 'registrant' }))
    await bindSignupDraft('registrant')
    await flushPendingSignupAnswers('registrant')
    expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
            userId: 'registrant',
            residenceCountry: 'AR',
            nationality: 'BR',
            signupPreferences: { fundingChannel: 'arsBank', paymentChannel: 'qr' },
        })
    )
})

it('does not resurrect acknowledged answers on a later startup bind', async () => {
    mockUpdate.mockResolvedValue({ data: {} })
    saveSignupDraft(snapshot())
    await bindSignupDraft('registrant')
    await flushPendingSignupAnswers('registrant')
    mockUpdate.mockClear()
    await bindSignupDraft('registrant')
    await flushPendingSignupAnswers('registrant')
    expect(mockUpdate).not.toHaveBeenCalled()
})

it('rejects malformed bounded draft envelopes (seed 24498, 64 generated cases)', () => {
    let seed = 24498
    const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0)
    for (let index = 0; index < 64; index++) {
        const good = { version: 2, savedAt: Date.now(), ...snapshot() }
        const bad = [
            { ...good, version: next() + 100 },
            { ...good, savedAt: Date.now() - 31 * 86400000 },
            { ...good, savedAt: Date.now() + 86400000 },
            { ...good, screenId: `unknown-${next()}` },
            { ...good, answers: null },
        ][next() % 5]
        localStorage.setItem(KEY, JSON.stringify(bad))
        expect(readSignupDraft()).toBeNull()
    }
})

it('keeps a verified registration receipt through a crash before hydration and queues its answers on restart', async () => {
    saveSignupDraft(snapshot())
    await recordSignupRegistration('registrant', 'kimchi.peanut.wallet')
    expect(readSignupDraft()?.userId).toBe('registrant')
    expect(mockUpdate).not.toHaveBeenCalled()
    await bindSignupDraft('registrant')
    await flushPendingSignupAnswers('registrant')
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ userId: 'registrant', residenceCountry: 'AR' }))
})

it('does not let an unrelated verify result claim this draft', async () => {
    saveSignupDraft(snapshot())
    await recordSignupRegistration('other', 'other.peanut.wallet')
    expect(readSignupDraft()?.userId).toBeUndefined()
    expect(mockUpdate).not.toHaveBeenCalled()
})

it('keeps a newer WebView draft rather than an older native fallback', async () => {
    mockNative = true
    mockPreferences.set(KEY, JSON.stringify({ version: 2, savedAt: Date.now(), ...snapshot(), screenId: 'invite' }))
    localStorage.setItem(KEY, JSON.stringify({ version: 2, savedAt: Date.now(), ...snapshot() }))
    expect((await restoreSignupDraft())?.screenId).toBe('passkey')
})

it('keeps the hold token stable for this session when persistent storage is unavailable', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked')
    })
    try {
        const token = await getUsernameHoldToken(true)
        expect(await getUsernameHoldToken()).toBe(token)
    } finally {
        jest.restoreAllMocks()
    }
})
