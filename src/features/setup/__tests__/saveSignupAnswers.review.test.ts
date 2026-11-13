import {
    __resetSignupSavesForTests,
    flushPendingSignupAnswers,
    queueSignupAnswers,
    saveSignupResidence,
} from '../saveSignupAnswers'

const mockUpdate = jest.fn()
jest.mock('@/app/actions/users', () => ({ updateUserById: (...args: unknown[]) => mockUpdate(...args) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false, isNativeBridge: () => false }))
jest.mock('@/utils/declared-residence.storage', () => ({
    storeDeclaredResidence: jest.fn(),
    storeSecondResidence: jest.fn(),
}))

const keyFor = (userId: string) => `peanut:pendingSignupAnswers:${encodeURIComponent(userId)}`
const read = (userId: string) => JSON.parse(localStorage.getItem(keyFor(userId)) ?? 'null')
const seed = (userId: string, savedAt: number | undefined = Date.now()) => {
    localStorage.setItem(
        keyFor(userId),
        JSON.stringify({ version: 1, userId, fields: { residenceCountry: 'PT', nationality: 'BR' }, savedAt })
    )
}
const settle = async () => {
    for (let index = 0; index < 30; index++) await Promise.resolve()
}

beforeEach(() => {
    localStorage.clear()
    __resetSignupSavesForTests()
    mockUpdate.mockReset().mockResolvedValue({ data: {} })
    jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

const permanentStatuses = Array.from({ length: 100 }, (_, index) => index + 400).filter(
    (status) => ![401, 408, 429].includes(status)
)

it.each(permanentStatuses)('discards rejected sent fields after permanent HTTP %i', async (status) => {
    const userId = `permanent-${status}`
    seed(userId)
    mockUpdate.mockResolvedValue({ error: 'rejected', failureKind: 'http', status })

    await flushPendingSignupAnswers(userId)
    expect(mockUpdate).toHaveBeenCalledWith({ userId, residenceCountry: 'PT', nationality: 'BR' })
    expect(read(userId)).toBeNull()

    mockUpdate.mockClear()
    await flushPendingSignupAnswers(userId)
    expect(mockUpdate).not.toHaveBeenCalled()
})

it('discards locked signup preferences after HTTP 409 and does not retry them', async () => {
    const userId = 'locked-preferences'
    await queueSignupAnswers(userId, {
        signupPreferences: { fundingChannel: 'bank' as never, paymentChannel: 'card' as never },
    })
    mockUpdate.mockResolvedValue({
        error: 'Signup preferences are locked',
        code: 'SIGNUP_PREFERENCES_LOCKED',
        failureKind: 'http',
        status: 409,
    })

    await flushPendingSignupAnswers(userId)

    expect(mockUpdate).toHaveBeenCalledWith({
        userId,
        signupPreferences: { fundingChannel: 'bank', paymentChannel: 'card' },
    })
    expect(read(userId)).toBeNull()
    mockUpdate.mockClear()
    await flushPendingSignupAnswers(userId)
    expect(mockUpdate).not.toHaveBeenCalled()
})

it.each([401, 408, 429, 500, 502, 503, 504])('retains answers for retry after HTTP %i', async (status) => {
    const userId = `retry-${status}`
    seed(userId)
    mockUpdate.mockResolvedValueOnce({ error: 'temporary failure', failureKind: 'http', status })

    await flushPendingSignupAnswers(userId)
    expect(read(userId)?.fields).toEqual({ residenceCountry: 'PT', nationality: 'BR' })
    await flushPendingSignupAnswers(userId)
    expect(mockUpdate).toHaveBeenCalledTimes(2)
    expect(read(userId)).toBeNull()
})

it.each(['network', 'timeout'])('retains answers after a %s failure', async (kind) => {
    seed(kind)
    if (kind === 'network') mockUpdate.mockResolvedValueOnce({ error: 'offline', failureKind: 'network' })
    else mockUpdate.mockRejectedValueOnce(new Error('request timeout'))

    await flushPendingSignupAnswers(kind)
    expect(read(kind)?.fields).toEqual({ residenceCountry: 'PT', nationality: 'BR' })
    await flushPendingSignupAnswers(kind)
    expect(mockUpdate).toHaveBeenCalledTimes(2)
    expect(read(kind)).toBeNull()
})

it.each([400, 422, 408, 429, 500])('never invokes onSaved after failed residence save (%i)', async (status) => {
    mockUpdate.mockResolvedValue({ error: 'failed', failureKind: 'http', status })
    const onSaved = jest.fn()

    saveSignupResidence(`callback-${status}`, 'PT', 'BR', onSaved)
    await settle()

    expect(mockUpdate).toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
})

it('invokes onSaved once after a successful residence save', async () => {
    const onSaved = jest.fn()
    saveSignupResidence('callback-success', 'PT', 'BR', onSaved)
    await settle()
    expect(onSaved).toHaveBeenCalledTimes(1)
})

it('discards records older than 30 days without making a request', async () => {
    seed('expired', Date.now() - 30 * 86400000 - 1)
    await flushPendingSignupAnswers('expired')
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(read('expired')).toBeNull()
})

it('flushes a legacy record with no savedAt', async () => {
    seed('legacy')
    const legacy = read('legacy')
    delete legacy.savedAt
    localStorage.setItem(keyFor('legacy'), JSON.stringify(legacy))

    await flushPendingSignupAnswers('legacy')
    expect(mockUpdate).toHaveBeenCalledWith({ userId: 'legacy', residenceCountry: 'PT', nationality: 'BR' })
    expect(read('legacy')).toBeNull()
})

it('timestamps legacy pending answers on the next queue operation', async () => {
    seed('legacy-queue')
    const legacy = read('legacy-queue')
    delete legacy.savedAt
    localStorage.setItem(keyFor('legacy-queue'), JSON.stringify(legacy))
    const before = Date.now()

    await queueSignupAnswers('legacy-queue', { residenceCountry: 'US' })

    expect(read('legacy-queue')).toMatchObject({
        version: 1,
        userId: 'legacy-queue',
        fields: { residenceCountry: 'US', nationality: 'BR' },
        savedAt: expect.any(Number),
    })
    expect(read('legacy-queue').savedAt).toBeGreaterThanOrEqual(before)
    expect(read('legacy-queue').savedAt).toBeLessThanOrEqual(Date.now())
})

it('drops only unchanged sent fields when a newer answer is queued during a permanent failure', async () => {
    seed('concurrent')
    let finish!: (value: unknown) => void
    let started!: () => void
    const requestStarted = new Promise<void>((resolve) => {
        started = resolve
    })
    mockUpdate.mockImplementationOnce(() => {
        started()
        return new Promise((resolve) => {
            finish = resolve
        })
    })

    const flushing = flushPendingSignupAnswers('concurrent')
    await requestStarted
    await queueSignupAnswers('concurrent', { residenceCountry: 'US' })
    finish({ error: 'rejected', failureKind: 'http', status: 422 })
    await flushing

    expect(read('concurrent')?.fields).toEqual({ residenceCountry: 'US' })
    await flushPendingSignupAnswers('concurrent')
    expect(mockUpdate).toHaveBeenLastCalledWith({ userId: 'concurrent', residenceCountry: 'US' })
})

it('keeps another account pending when one account receives a permanent failure', async () => {
    seed('user/a')
    seed('user%2Fa')
    mockUpdate.mockResolvedValueOnce({ error: 'rejected', failureKind: 'http', status: 403 })

    await flushPendingSignupAnswers('user/a')

    expect(read('user/a')).toBeNull()
    expect(read('user%2Fa')?.fields).toEqual({ residenceCountry: 'PT', nationality: 'BR' })
    await flushPendingSignupAnswers('user%2Fa')
    expect(mockUpdate).toHaveBeenLastCalledWith({ userId: 'user%2Fa', residenceCountry: 'PT', nationality: 'BR' })
})
