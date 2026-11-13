export {}

const mockApiFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false, isNativeBridge: () => false }))
const mockCaptureMessage = jest.fn()
jest.mock('@/utils/sentry-lazy', () => ({ captureMessage: (...args: unknown[]) => mockCaptureMessage(...args) }))

const KEY = 'peanut:username-hold:v1'
const STORED_TOKEN = 'A'.repeat(43)
let reservation: typeof import('../username-reservation')
const response = (status: number) => ({ ok: status >= 200 && status < 300, status, json: async () => ({}) })

beforeEach(() => {
    jest.resetModules()
    localStorage.clear()
    mockApiFetch.mockReset().mockResolvedValue(response(200))
    mockCaptureMessage.mockReset()
    reservation = require('../username-reservation')
})

afterEach(() => jest.restoreAllMocks())

it('persists a valid token and reuses it until explicitly released', async () => {
    const token = await reservation.getUsernameHoldToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(localStorage.getItem(KEY)).toBe(token)
    expect(await reservation.getUsernameHoldToken()).toBe(token)
})

it('marks reservation requests as reporting their own failures', async () => {
    expect(await reservation.reserveUsername('kimchi')).toBe('reserved')
    expect(mockApiFetch).toHaveBeenCalledWith(
        '/users/username/reservations',
        expect.objectContaining({ method: 'POST', callerReportsFailures: true })
    )
})

it('reports reservation endpoint absence as unavailable', async () => {
    mockApiFetch.mockResolvedValue(response(404))
    expect(await reservation.reserveUsername('kimchi')).toBe('unavailable')
    expect(mockApiFetch).toHaveBeenCalledWith(
        '/users/username/reservations',
        expect.objectContaining({ method: 'POST', callerReportsFailures: true })
    )
})

it.each([200, 204, 400, 404, 429, 500])(
    'clears persisted and in-memory tokens after release HTTP %i',
    async (status) => {
        const oldToken = await reservation.getUsernameHoldToken()
        mockApiFetch.mockResolvedValue(response(status))

        await reservation.releaseUsernameReservation()

        expect(mockApiFetch).toHaveBeenCalledWith(
            '/users/username/reservations',
            expect.objectContaining({ method: 'DELETE', callerReportsFailures: true })
        )
        expect(localStorage.getItem(KEY)).toBeNull()
        await reservation.releaseUsernameReservation()
        expect(mockApiFetch).toHaveBeenCalledTimes(1)
        const freshToken = await reservation.getUsernameHoldToken()
        expect(freshToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(freshToken).not.toBe(oldToken)
        expect(localStorage.getItem(KEY)).toBe(freshToken)
    }
)

it('clears persisted and in-memory tokens after a network failure during release', async () => {
    const oldToken = await reservation.getUsernameHoldToken()
    mockApiFetch.mockRejectedValue(new Error('offline'))

    await reservation.releaseUsernameReservation()

    expect(mockApiFetch).toHaveBeenCalledWith(
        '/users/username/reservations',
        expect.objectContaining({ method: 'DELETE', callerReportsFailures: true })
    )
    expect(localStorage.getItem(KEY)).toBeNull()
    await reservation.releaseUsernameReservation()
    expect(mockApiFetch).toHaveBeenCalledTimes(1)
    expect(await reservation.getUsernameHoldToken()).not.toBe(oldToken)
})

it('releases a persisted token after a module restart', async () => {
    localStorage.setItem(KEY, STORED_TOKEN)

    await reservation.releaseUsernameReservation()

    expect(mockApiFetch).toHaveBeenCalledTimes(1)
    expect(mockApiFetch).toHaveBeenCalledWith(
        '/users/username/reservations',
        expect.objectContaining({ method: 'DELETE', callerReportsFailures: true })
    )
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(await reservation.getUsernameHoldToken()).not.toBe(STORED_TOKEN)
})

it('clears the in-memory token on release when persistent storage is blocked', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked')
    })
    const oldToken = await reservation.getUsernameHoldToken()

    await reservation.releaseUsernameReservation()

    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(await reservation.getUsernameHoldToken()).not.toBe(oldToken)
})

it.each([null, '', 'short', 'A'.repeat(42), 'A'.repeat(44), '!'.repeat(43)])(
    'does not create or release a hold when stored token is invalid (%s)',
    async (stored) => {
        if (stored !== null) localStorage.setItem(KEY, stored)

        await reservation.releaseUsernameReservation()

        expect(mockApiFetch).not.toHaveBeenCalled()
    }
)

describe('hold failures the fetch layer no longer reports', () => {
    it('stays quiet while the API has no hold endpoint (404)', async () => {
        mockApiFetch.mockResolvedValue(response(404))
        await reservation.reserveUsername('kimchi')
        localStorage.setItem(KEY, STORED_TOKEN)
        await reservation.releaseUsernameReservation()
        expect(mockCaptureMessage).not.toHaveBeenCalled()
    })

    it.each([500, 503, 429])('reports an unexpected %i on reserve', async (status) => {
        mockApiFetch.mockResolvedValue(response(status))
        expect(await reservation.reserveUsername('kimchi')).toBe('unavailable')
        expect(mockCaptureMessage).toHaveBeenCalledWith(
            'username hold request failed',
            expect.objectContaining({ tags: expect.objectContaining({ operation: 'reserve', status: String(status) }) })
        )
    })

    it('reports a transport failure on reserve and on release', async () => {
        mockApiFetch.mockRejectedValue(new TypeError('Failed to fetch'))
        expect(await reservation.reserveUsername('kimchi')).toBe('unavailable')
        localStorage.setItem(KEY, STORED_TOKEN)
        await reservation.releaseUsernameReservation()
        const operations = mockCaptureMessage.mock.calls.map(([, context]) => context.tags.operation)
        expect(operations).toEqual(['reserve', 'release'])
    })

    it('does not report handled outcomes', async () => {
        mockApiFetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: 'USERNAME_TAKEN' }) })
        expect(await reservation.reserveUsername('kimchi')).toBe('taken')
        expect(mockCaptureMessage).not.toHaveBeenCalled()
    })
})
