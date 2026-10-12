import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { ApiError } from '@/services/api-error'
import { SHAKE_MAX_POLL_FAILURES, SHAKE_POLL_INTERVAL_MS, useShakeSession } from '../useShakeSession'
import type { ShakeCandidate, ShakeLocation, ShakeSessionResponse, ShakeSessionStatus } from '../shakeApi'

const mockCreateSession = jest.fn()
const mockGetSession = jest.fn()
const mockCancelSession = jest.fn()
jest.mock('../shakeApi', () => ({
    shakeApi: {
        createSession: (...args: unknown[]) => mockCreateSession(...args),
        getSession: (...args: unknown[]) => mockGetSession(...args),
        cancelSession: (...args: unknown[]) => mockCancelSession(...args),
    },
}))

// ---------------------------------------------------------------------------
// fixtures and helpers
// ---------------------------------------------------------------------------

const candidate = (username: string, extra: Partial<ShakeCandidate> = {}): ShakeCandidate => ({
    username,
    displayName: null,
    avatarKey: null,
    isVerified: false,
    ...extra,
})

const ANA = candidate('ana', { displayName: 'Ana Gomez', avatarKey: 'basic.cat', isVerified: true })
const BOB = candidate('bob')
const CARL = candidate('carl', { displayName: 'Carl' })

const LOCATION: ShakeLocation = { latitude: 52.37, longitude: 4.895, accuracyM: 35 }

const makeSession = (
    sessionId: string,
    candidates: ShakeCandidate[] = [],
    status: ShakeSessionStatus = 'active'
): ShakeSessionResponse => ({
    sessionId,
    shakenAt: new Date(Date.now()).toISOString(),
    expiresAt: new Date(Date.now() + 90_000).toISOString(),
    status,
    candidates,
})

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

/**
 * A rejected promise that records whether anyone attached a rejection handler,
 * and that is itself marked handled so a missing handler fails an assertion
 * instead of crashing the Jest worker with an unhandled rejection.
 */
class TrackedRejection extends Promise<void> {
    handled = false

    static of(reason: unknown): TrackedRejection {
        const promise = new TrackedRejection((_resolve, reject) => reject(reason))
        Promise.prototype.then.call(promise, undefined, () => undefined)
        return promise
    }

    then<TResult1 = void, TResult2 = never>(
        onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
        if (onrejected) this.handled = true
        return super.then(onfulfilled, onrejected)
    }
}

const advance = (ms: number) =>
    act(async () => {
        await jest.advanceTimersByTimeAsync(ms)
    })

const pollsFor = (sessionId: string) => mockGetSession.mock.calls.filter(([id]) => id === sessionId).length

const rateLimitError = (retryAfterSec?: number) =>
    new ApiError('Too many shakes', { status: 429, code: 'SHAKE_RATE_LIMITED', retryAfterSec })

type Hook = ReturnType<typeof renderHook<ReturnType<typeof useShakeSession>, unknown>>

/** Every committed (state, candidates) pair, so a test can prove a value never showed up on screen. */
let history: Array<{ state: string; usernames: string[] }> = []
const everShowed = (username: string) => history.some((entry) => entry.usernames.includes(username))

function setup(options?: { strict?: boolean }) {
    return renderHook(
        () => {
            const value = useShakeSession()
            history.push({ state: value.state, usernames: value.candidates.map((c) => c.username) })
            return value
        },
        options?.strict ? { wrapper: StrictMode } : undefined
    )
}

/**
 * Starts a shake without waiting for it, for tests that control the response by
 * hand. Resolves once the shake has had time to put its create call on the
 * wire, so it is genuinely in flight; `done` settles when the shake does.
 */
async function startShake(hook: Hook, location?: ShakeLocation | null): Promise<{ done: Promise<void> }> {
    let done!: Promise<void>
    act(() => {
        done = hook.result.current.shake(location)
    })
    await advance(0)
    return { done }
}

/** Runs a shake to completion (the create response has been applied). */
async function shakeNow(hook: Hook, location?: ShakeLocation | null) {
    await act(async () => {
        await hook.result.current.shake(location)
    })
}

function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' })
}

const fireVisibilityChange = () =>
    act(async () => {
        document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
        await jest.advanceTimersByTimeAsync(0)
    })

beforeEach(() => {
    history = []
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-12T10:00:00.000Z'))
    mockCreateSession.mockReset()
    mockGetSession.mockReset()
    mockCancelSession.mockReset()
    let created = 0
    mockCreateSession.mockImplementation(async () => makeSession(`s${++created}`, [ANA]))
    mockGetSession.mockImplementation(async (id: string) => makeSession(id, [ANA]))
    mockCancelSession.mockResolvedValue(undefined)
})

afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
    Reflect.deleteProperty(document, 'visibilityState')
    Reflect.deleteProperty(document, 'hidden')
})

// ---------------------------------------------------------------------------

describe('useShakeSession: constants and initial state', () => {
    it('polls every 1500 ms and gives up after 3 consecutive failures', () => {
        expect(SHAKE_POLL_INTERVAL_MS).toBe(1500)
        expect(SHAKE_MAX_POLL_FAILURES).toBe(3)
    })

    it('starts idle with nothing found and does not touch the API', async () => {
        const hook = setup()
        await advance(SHAKE_POLL_INTERVAL_MS * 5)

        expect(hook.result.current.state).toBe('idle')
        expect(hook.result.current.candidates).toEqual([])
        expect(hook.result.current.retryAfterSeconds).toBeNull()
        expect(mockCreateSession).not.toHaveBeenCalled()
        expect(mockGetSession).not.toHaveBeenCalled()
        expect(mockCancelSession).not.toHaveBeenCalled()
    })
})

describe('useShakeSession: shake()', () => {
    it('creates one session, passing the location along', async () => {
        const hook = setup()
        await shakeNow(hook, LOCATION)

        expect(mockCreateSession).toHaveBeenCalledTimes(1)
        expect(mockCreateSession).toHaveBeenCalledWith(LOCATION)
    })

    it.each([[null], [undefined]])('creates a session without a location when given %s', async (location) => {
        const hook = setup()
        await shakeNow(hook, location)

        expect(mockCreateSession).toHaveBeenCalledTimes(1)
        expect(mockCreateSession.mock.calls[0][0] ?? null).toBeNull()
    })

    it('moves to searching with the candidates from the create response', async () => {
        mockCreateSession.mockResolvedValue(makeSession('s1', [ANA, BOB]))
        const hook = setup()
        await shakeNow(hook, LOCATION)

        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([ANA, BOB])
        expect(hook.result.current.retryAfterSeconds).toBeNull()
    })

    it('is searching with an empty list when nobody has shaken yet', async () => {
        mockCreateSession.mockResolvedValue(makeSession('s1', []))
        const hook = setup()
        await shakeNow(hook)

        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([])
    })

    it('the first shake has no previous session to cancel', async () => {
        const hook = setup()
        await shakeNow(hook)

        expect(mockCancelSession).not.toHaveBeenCalled()
    })

    it('never rejects, whatever the create call does', async () => {
        const hook = setup()
        const failures = [new Error('network down'), rateLimitError(5), new ApiError('boom', { status: 500 })]
        for (const failure of failures) {
            mockCreateSession.mockRejectedValueOnce(failure)
            await act(async () => {
                await expect(hook.result.current.shake(LOCATION)).resolves.toBeUndefined()
            })
        }
    })

    it('does not poll more than once a session per interval across many shakes', async () => {
        const hook = setup()
        await shakeNow(hook)
        await shakeNow(hook)
        await shakeNow(hook)
        mockGetSession.mockClear()

        await advance(SHAKE_POLL_INTERVAL_MS)

        expect(mockGetSession).toHaveBeenCalledTimes(1)
        expect(mockGetSession).toHaveBeenCalledWith('s3')
    })
})

describe('useShakeSession: polling', () => {
    it('waits a full interval before the first poll', async () => {
        const hook = setup()
        await shakeNow(hook)

        await advance(SHAKE_POLL_INTERVAL_MS - 1)
        expect(mockGetSession).not.toHaveBeenCalled()

        await advance(1)
        expect(mockGetSession).toHaveBeenCalledTimes(1)
        expect(mockGetSession).toHaveBeenCalledWith('s1')
    })

    it('then polls once per interval', async () => {
        const hook = setup()
        await shakeNow(hook)

        for (let polls = 1; polls <= 6; polls++) {
            await advance(SHAKE_POLL_INTERVAL_MS)
            expect(mockGetSession).toHaveBeenCalledTimes(polls)
        }
        expect(mockGetSession.mock.calls.every(([id]) => id === 's1')).toBe(true)
    })

    it('follows the candidates the server reports on each poll', async () => {
        mockCreateSession.mockResolvedValue(makeSession('s1', [ANA]))
        mockGetSession
            .mockResolvedValueOnce(makeSession('s1', [ANA, BOB]))
            .mockResolvedValueOnce(makeSession('s1', [BOB]))
            .mockResolvedValueOnce(makeSession('s1', []))
        const hook = setup()
        await shakeNow(hook)
        expect(hook.result.current.candidates).toEqual([ANA])

        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(hook.result.current.candidates).toEqual([ANA, BOB])
        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(hook.result.current.candidates).toEqual([BOB])
        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(hook.result.current.candidates).toEqual([])
        expect(hook.result.current.state).toBe('searching')
    })

    it.each<ShakeSessionStatus>(['expired', 'cancelled'])(
        'a poll that reports the session %s ends the search: state expired, candidates cleared, polling stops',
        async (status) => {
            mockGetSession.mockResolvedValueOnce(makeSession('s1', [ANA, BOB])).mockResolvedValue(
                // the server never lists anyone for a session that is not active
                makeSession('s1', [], status)
            )
            const hook = setup()
            await shakeNow(hook)

            await advance(SHAKE_POLL_INTERVAL_MS)
            expect(hook.result.current.state).toBe('searching')
            expect(hook.result.current.candidates).toEqual([ANA, BOB])

            await advance(SHAKE_POLL_INTERVAL_MS)
            expect(hook.result.current.state).toBe('expired')
            expect(hook.result.current.candidates).toEqual([])

            const callsAtExpiry = mockGetSession.mock.calls.length
            await advance(SHAKE_POLL_INTERVAL_MS * 10)
            expect(mockGetSession).toHaveBeenCalledTimes(callsAtExpiry)
            expect(hook.result.current.state).toBe('expired')
        }
    )

    it('clears candidates on expiry even if the response still lists some', async () => {
        mockGetSession.mockResolvedValue(makeSession('s1', [ANA], 'expired'))
        const hook = setup()
        await shakeNow(hook)

        await advance(SHAKE_POLL_INTERVAL_MS)

        expect(hook.result.current.state).toBe('expired')
        expect(hook.result.current.candidates).toEqual([])
    })

    it('does not stack requests while a poll is still in flight', async () => {
        const slow = deferred<ShakeSessionResponse>()
        mockGetSession.mockReturnValue(slow.promise)
        const hook = setup()
        await shakeNow(hook)

        await advance(SHAKE_POLL_INTERVAL_MS * 10)
        expect(mockGetSession.mock.calls.length).toBeLessThanOrEqual(1)

        mockGetSession.mockImplementation(async (id: string) => makeSession(id, [ANA, BOB]))
        await act(async () => {
            slow.resolve(makeSession('s1', [ANA]))
        })
        await advance(SHAKE_POLL_INTERVAL_MS * 2)
        expect(mockGetSession.mock.calls.length).toBeGreaterThanOrEqual(2)
        expect(hook.result.current.candidates).toEqual([ANA, BOB])
    })

    it('re-rendering does not disturb the session: nothing is cancelled and the cadence is kept', async () => {
        const hook = setup()
        await shakeNow(hook)
        await advance(1000)

        hook.rerender()
        hook.rerender()
        await advance(500)

        expect(mockCancelSession).not.toHaveBeenCalled()
        expect(mockCreateSession).toHaveBeenCalledTimes(1)
        expect(mockGetSession).toHaveBeenCalledTimes(1)
        expect(hook.result.current.state).toBe('searching')
    })
})

describe('useShakeSession: poll failures', () => {
    const failures: Array<[string, () => unknown]> = [
        ['a network error', () => new TypeError('Failed to fetch')],
        ['an ApiError 500', () => new ApiError('boom', { status: 500 })],
        ['an ApiError 404', () => new ApiError('gone', { status: 404, code: 'SHAKE_SESSION_NOT_FOUND' })],
    ]

    it.each(failures)('a failed poll (%s) keeps the last candidates and keeps polling', async (_label, makeFailure) => {
        mockGetSession
            .mockResolvedValueOnce(makeSession('s1', [ANA, BOB]))
            .mockRejectedValueOnce(makeFailure())
            .mockResolvedValue(makeSession('s1', [BOB, CARL]))
        const hook = setup()
        await shakeNow(hook)

        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(hook.result.current.candidates).toEqual([ANA, BOB])

        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([ANA, BOB])

        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([BOB, CARL])
    })

    it('fewer than SHAKE_MAX_POLL_FAILURES failures in a row are tolerated', async () => {
        mockGetSession.mockRejectedValue(new Error('offline'))
        const hook = setup()
        await shakeNow(hook)

        await advance(SHAKE_POLL_INTERVAL_MS * (SHAKE_MAX_POLL_FAILURES - 1))

        expect(mockGetSession).toHaveBeenCalledTimes(SHAKE_MAX_POLL_FAILURES - 1)
        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([ANA])
    })

    it.each(failures)(
        'SHAKE_MAX_POLL_FAILURES consecutive failures (%s) end in error, and polling stops',
        async (_label, makeFailure) => {
            mockGetSession.mockImplementation(async () => {
                throw makeFailure()
            })
            const hook = setup()
            await shakeNow(hook)

            await advance(SHAKE_POLL_INTERVAL_MS * SHAKE_MAX_POLL_FAILURES)

            expect(hook.result.current.state).toBe('error')
            expect(mockGetSession).toHaveBeenCalledTimes(SHAKE_MAX_POLL_FAILURES)

            await advance(SHAKE_POLL_INTERVAL_MS * 20)
            expect(mockGetSession).toHaveBeenCalledTimes(SHAKE_MAX_POLL_FAILURES)
            expect(hook.result.current.state).toBe('error')
        }
    )

    it('a success resets the failure counter', async () => {
        const failing = new Error('offline')
        // F F S F F -> still searching; the next F is the third in a row since the success
        mockGetSession
            .mockRejectedValueOnce(failing)
            .mockRejectedValueOnce(failing)
            .mockResolvedValueOnce(makeSession('s1', [ANA, BOB]))
            .mockRejectedValueOnce(failing)
            .mockRejectedValueOnce(failing)
            .mockRejectedValueOnce(failing)
        const hook = setup()
        await shakeNow(hook)

        await advance(SHAKE_POLL_INTERVAL_MS * 5)
        expect(mockGetSession).toHaveBeenCalledTimes(5)
        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([ANA, BOB])

        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(mockGetSession).toHaveBeenCalledTimes(6)
        expect(hook.result.current.state).toBe('error')
    })

    it('a shake after an error starts over with a fresh failure budget', async () => {
        mockGetSession.mockRejectedValue(new Error('offline'))
        const hook = setup()
        await shakeNow(hook)
        await advance(SHAKE_POLL_INTERVAL_MS * SHAKE_MAX_POLL_FAILURES)
        expect(hook.result.current.state).toBe('error')

        mockGetSession.mockClear()
        await shakeNow(hook)
        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([ANA])

        await advance(SHAKE_POLL_INTERVAL_MS * (SHAKE_MAX_POLL_FAILURES - 1))
        expect(hook.result.current.state).toBe('searching')
        expect(mockGetSession).toHaveBeenCalledTimes(SHAKE_MAX_POLL_FAILURES - 1)
        expect(mockGetSession.mock.calls.every(([id]) => id === 's2')).toBe(true)

        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(hook.result.current.state).toBe('error')
    })

    it('a shake after the search expired looks again', async () => {
        mockGetSession.mockResolvedValueOnce(makeSession('s1', [], 'expired'))
        const hook = setup()
        await shakeNow(hook)
        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(hook.result.current.state).toBe('expired')

        mockCreateSession.mockResolvedValueOnce(makeSession('s2', [BOB]))
        await shakeNow(hook)

        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([BOB])
        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(mockGetSession).toHaveBeenLastCalledWith('s2')
    })
})

describe('useShakeSession: create failures', () => {
    it('429 becomes rate-limited, with the seconds from the error, and nothing is polled', async () => {
        mockCreateSession.mockRejectedValue(rateLimitError(12))
        const hook = setup()
        await shakeNow(hook, LOCATION)

        expect(hook.result.current.state).toBe('rate-limited')
        expect(hook.result.current.retryAfterSeconds).toBe(12)
        expect(hook.result.current.candidates).toEqual([])

        await advance(SHAKE_POLL_INTERVAL_MS * 10)
        expect(mockGetSession).not.toHaveBeenCalled()
        expect(mockCreateSession).toHaveBeenCalledTimes(1)
    })

    it('429 without a Retry-After value is rate-limited with retryAfterSeconds null', async () => {
        mockCreateSession.mockRejectedValue(rateLimitError(undefined))
        const hook = setup()
        await shakeNow(hook)

        expect(hook.result.current.state).toBe('rate-limited')
        expect(hook.result.current.retryAfterSeconds).toBeNull()
    })

    it('any 429, whatever its code, is rate-limited', async () => {
        mockCreateSession.mockRejectedValue(new ApiError('slow down', { status: 429, retryAfterSec: 3 }))
        const hook = setup()
        await shakeNow(hook)

        expect(hook.result.current.state).toBe('rate-limited')
        expect(hook.result.current.retryAfterSeconds).toBe(3)
    })

    it.each<[string, () => unknown]>([
        ['an ApiError 500', () => new ApiError('boom', { status: 500 })],
        [
            'an ApiError 403 (no username)',
            () => new ApiError('username', { status: 403, code: 'SHAKE_USERNAME_REQUIRED' }),
        ],
        ['an ApiError 401', () => new ApiError('unauthorized', { status: 401 })],
        ['a network error', () => new TypeError('Failed to fetch')],
    ])('%s becomes error, with no candidates, and nothing is polled', async (_label, makeFailure) => {
        mockCreateSession.mockRejectedValue(makeFailure())
        const hook = setup()
        await shakeNow(hook)

        expect(hook.result.current.state).toBe('error')
        expect(hook.result.current.candidates).toEqual([])
        expect(hook.result.current.retryAfterSeconds).toBeNull()

        await advance(SHAKE_POLL_INTERVAL_MS * 10)
        expect(mockGetSession).not.toHaveBeenCalled()
    })

    it('a shake after being rate-limited searches normally and drops the old retry time', async () => {
        mockCreateSession.mockRejectedValueOnce(rateLimitError(30))
        const hook = setup()
        await shakeNow(hook)
        expect(hook.result.current.retryAfterSeconds).toBe(30)

        mockCreateSession.mockResolvedValueOnce(makeSession('s9', [BOB]))
        await shakeNow(hook)

        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.retryAfterSeconds).toBeNull()
        expect(hook.result.current.candidates).toEqual([BOB])
    })

    it('a failed re-shake still cancels the previous session and stops polling it', async () => {
        const hook = setup()
        await shakeNow(hook)
        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(pollsFor('s1')).toBe(1)

        mockCreateSession.mockRejectedValueOnce(rateLimitError(8))
        await shakeNow(hook)

        expect(mockCancelSession).toHaveBeenCalledWith('s1')
        expect(hook.result.current.state).toBe('rate-limited')
        await advance(SHAKE_POLL_INTERVAL_MS * 5)
        expect(pollsFor('s1')).toBe(1)
    })
})

describe('useShakeSession: re-shake', () => {
    it('cancels the previous session and creates a new one', async () => {
        const hook = setup()
        await shakeNow(hook)
        await shakeNow(hook)

        expect(mockCancelSession).toHaveBeenCalledTimes(1)
        expect(mockCancelSession).toHaveBeenCalledWith('s1')
        expect(mockCreateSession).toHaveBeenCalledTimes(2)
    })

    it('shows the new session, polls only it, and does not double up the cadence', async () => {
        mockCreateSession
            .mockResolvedValueOnce(makeSession('s1', [ANA]))
            .mockResolvedValueOnce(makeSession('s2', [BOB]))
        const hook = setup()
        await shakeNow(hook)
        await advance(1000)
        await shakeNow(hook)

        expect(hook.result.current.candidates).toEqual([BOB])
        expect(hook.result.current.state).toBe('searching')

        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(mockGetSession).toHaveBeenCalledTimes(1)
        expect(mockGetSession).toHaveBeenCalledWith('s2')

        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(mockGetSession).toHaveBeenCalledTimes(2)
        expect(pollsFor('s1')).toBe(0)
    })

    it('each shake cancels exactly the session before it', async () => {
        const hook = setup()
        await shakeNow(hook)
        await shakeNow(hook)
        await shakeNow(hook)

        expect(mockCancelSession.mock.calls.map(([id]) => id)).toEqual(['s1', 's2'])
    })

    it('ignores a failed cancel of the previous session and carries on', async () => {
        const rejection = TrackedRejection.of(new Error('cancel failed'))
        mockCancelSession.mockReturnValue(rejection)
        const hook = setup()
        await shakeNow(hook)
        await shakeNow(hook)

        expect(mockCancelSession).toHaveBeenCalledWith('s1')
        expect(rejection.handled).toBe(true)
        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([ANA])
    })

    it('does not wait for the cancel before creating the new session', async () => {
        const slowCancel = deferred<void>()
        mockCancelSession.mockReturnValue(slowCancel.promise)
        const hook = setup()
        await shakeNow(hook)

        await shakeNow(hook)

        expect(mockCreateSession).toHaveBeenCalledTimes(2)
        expect(hook.result.current.state).toBe('searching')
    })
})

describe('useShakeSession: responses from an older session never win', () => {
    // These hold whether the hook issues overlapping creates or queues the second
    // one behind the first: only the end state and what was ever shown are checked.

    it('a create response that lands after a newer shake is dropped, its session cancelled, and never shown', async () => {
        const first = deferred<ShakeSessionResponse>()
        const second = deferred<ShakeSessionResponse>()
        mockCreateSession.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
        const hook = setup()

        const shake1 = await startShake(hook)
        history = []
        const shake2 = await startShake(hook)

        await act(async () => {
            first.resolve(makeSession('s1', [ANA]))
            await jest.advanceTimersByTimeAsync(0)
        })
        expect(everShowed('ana')).toBe(false)
        expect(mockCancelSession).toHaveBeenCalledWith('s1')

        await act(async () => {
            second.resolve(makeSession('s2', [BOB]))
            await Promise.all([shake1.done, shake2.done])
        })

        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([BOB])
        expect(everShowed('ana')).toBe(false)
        expect(mockCancelSession).not.toHaveBeenCalledWith('s2')

        await advance(SHAKE_POLL_INTERVAL_MS * 3)
        expect(pollsFor('s1')).toBe(0)
        expect(pollsFor('s2')).toBe(3)
    })

    it('the same when the newer response is already there by the time the older one lands', async () => {
        const first = deferred<ShakeSessionResponse>()
        const second = deferred<ShakeSessionResponse>()
        mockCreateSession.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
        const hook = setup()

        const shake1 = await startShake(hook)
        history = []
        const shake2 = await startShake(hook)
        await act(async () => {
            second.resolve(makeSession('s2', [BOB]))
            await jest.advanceTimersByTimeAsync(0)
        })
        await act(async () => {
            first.resolve(makeSession('s1', [ANA]))
            await Promise.all([shake1.done, shake2.done])
        })

        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([BOB])
        expect(everShowed('ana')).toBe(false)
        expect(mockCancelSession).toHaveBeenCalledWith('s1')
        expect(mockCancelSession).not.toHaveBeenCalledWith('s2')
        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(pollsFor('s1')).toBe(0)
        expect(pollsFor('s2')).toBe(1)
    })

    it('a create FAILURE from an older shake does not overwrite the newer session', async () => {
        const first = deferred<ShakeSessionResponse>()
        mockCreateSession.mockReturnValueOnce(first.promise).mockResolvedValueOnce(makeSession('s2', [BOB]))
        const hook = setup()

        const shake1 = await startShake(hook)
        const shake2 = await startShake(hook)
        await act(async () => {
            first.reject(rateLimitError(30))
            await Promise.all([shake1.done, shake2.done])
        })

        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.retryAfterSeconds).toBeNull()
        expect(hook.result.current.candidates).toEqual([BOB])
        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(pollsFor('s2')).toBe(1)
    })

    it('a create failure from an older shake does not flag an error while the newer shake is still in flight', async () => {
        const first = deferred<ShakeSessionResponse>()
        const second = deferred<ShakeSessionResponse>()
        mockCreateSession.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
        const hook = setup()

        const shake1 = await startShake(hook)
        const shake2 = await startShake(hook)
        await act(async () => {
            first.reject(new Error('network down'))
            await jest.advanceTimersByTimeAsync(0)
        })
        expect(hook.result.current.state).not.toBe('error')

        await act(async () => {
            second.resolve(makeSession('s2', [BOB]))
            await Promise.all([shake1.done, shake2.done])
        })
        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([BOB])
    })

    it('a late ACTIVE poll response from the older session does not overwrite the newer candidates', async () => {
        const latePoll = deferred<ShakeSessionResponse>()
        mockCreateSession
            .mockResolvedValueOnce(makeSession('s1', [ANA]))
            .mockResolvedValueOnce(makeSession('s2', [BOB]))
        mockGetSession.mockImplementation((id: string) =>
            id === 's1' ? latePoll.promise : Promise.resolve(makeSession(id, [BOB]))
        )
        const hook = setup()
        await shakeNow(hook)
        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(pollsFor('s1')).toBe(1)

        await shakeNow(hook)
        await act(async () => {
            latePoll.resolve(makeSession('s1', [ANA, CARL]))
        })

        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([BOB])
    })

    it.each<ShakeSessionStatus>(['expired', 'cancelled'])(
        'a late %s poll response from the older session does not end the newer search',
        async (status) => {
            const latePoll = deferred<ShakeSessionResponse>()
            mockCreateSession
                .mockResolvedValueOnce(makeSession('s1', [ANA]))
                .mockResolvedValueOnce(makeSession('s2', [BOB]))
            mockGetSession.mockImplementation((id: string) =>
                id === 's1' ? latePoll.promise : Promise.resolve(makeSession(id, [BOB]))
            )
            const hook = setup()
            await shakeNow(hook)
            await advance(SHAKE_POLL_INTERVAL_MS)
            await shakeNow(hook)

            await act(async () => {
                latePoll.resolve(makeSession('s1', [], status))
            })

            expect(hook.result.current.state).toBe('searching')
            expect(hook.result.current.candidates).toEqual([BOB])

            await advance(SHAKE_POLL_INTERVAL_MS)
            expect(pollsFor('s2')).toBe(1)
            expect(hook.result.current.state).toBe('searching')
        }
    )

    it('a late poll FAILURE from the older session does not count against the newer one', async () => {
        const latePoll = deferred<ShakeSessionResponse>()
        mockCreateSession
            .mockResolvedValueOnce(makeSession('s1', [ANA]))
            .mockResolvedValueOnce(makeSession('s2', [BOB]))
        mockGetSession.mockImplementation((id: string) =>
            id === 's1' ? latePoll.promise : Promise.reject(new Error('offline'))
        )
        const hook = setup()
        await shakeNow(hook)
        await advance(SHAKE_POLL_INTERVAL_MS)
        await shakeNow(hook)

        await act(async () => {
            latePoll.reject(new Error('offline'))
        })
        expect(hook.result.current.state).toBe('searching')

        // two real failures of the new session: with the stale one counted this would already be the third
        await advance(SHAKE_POLL_INTERVAL_MS * (SHAKE_MAX_POLL_FAILURES - 1))
        expect(hook.result.current.state).toBe('searching')

        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(hook.result.current.state).toBe('error')
    })
})

describe('useShakeSession: stop()', () => {
    it('cancels the current session, goes idle, clears candidates and stops polling', async () => {
        const hook = setup()
        await shakeNow(hook)
        await advance(SHAKE_POLL_INTERVAL_MS)
        const pollsBefore = mockGetSession.mock.calls.length

        await act(async () => {
            hook.result.current.stop()
        })

        expect(mockCancelSession).toHaveBeenCalledTimes(1)
        expect(mockCancelSession).toHaveBeenCalledWith('s1')
        expect(hook.result.current.state).toBe('idle')
        expect(hook.result.current.candidates).toEqual([])

        await advance(SHAKE_POLL_INTERVAL_MS * 10)
        expect(mockGetSession).toHaveBeenCalledTimes(pollsBefore)
        expect(hook.result.current.state).toBe('idle')
    })

    it('with nothing running it is a no-op that does not call the API', async () => {
        const hook = setup()

        await act(async () => {
            hook.result.current.stop()
        })

        expect(hook.result.current.state).toBe('idle')
        expect(mockCancelSession).not.toHaveBeenCalled()
    })

    it('calling it twice cancels once', async () => {
        const hook = setup()
        await shakeNow(hook)

        await act(async () => {
            hook.result.current.stop()
            hook.result.current.stop()
        })

        expect(mockCancelSession).toHaveBeenCalledTimes(1)
    })

    it('returns an expired search to idle', async () => {
        mockGetSession.mockResolvedValue(makeSession('s1', [], 'expired'))
        const hook = setup()
        await shakeNow(hook)
        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(hook.result.current.state).toBe('expired')

        await act(async () => {
            hook.result.current.stop()
        })

        expect(hook.result.current.state).toBe('idle')
    })

    it('returns an error state to idle', async () => {
        mockGetSession.mockRejectedValue(new Error('offline'))
        const hook = setup()
        await shakeNow(hook)
        await advance(SHAKE_POLL_INTERVAL_MS * SHAKE_MAX_POLL_FAILURES)
        expect(hook.result.current.state).toBe('error')

        await act(async () => {
            hook.result.current.stop()
        })

        expect(hook.result.current.state).toBe('idle')
    })

    it('returns a rate-limited state to idle', async () => {
        mockCreateSession.mockRejectedValue(rateLimitError(20))
        const hook = setup()
        await shakeNow(hook)
        expect(hook.result.current.state).toBe('rate-limited')

        await act(async () => {
            hook.result.current.stop()
        })

        expect(hook.result.current.state).toBe('idle')
    })

    it('ignores a failed cancel', async () => {
        const rejection = TrackedRejection.of(new Error('cancel failed'))
        mockCancelSession.mockReturnValue(rejection)
        const hook = setup()
        await shakeNow(hook)

        await act(async () => {
            hook.result.current.stop()
        })

        expect(rejection.handled).toBe(true)
        expect(hook.result.current.state).toBe('idle')
        await advance(SHAKE_POLL_INTERVAL_MS * 3)
        expect(hook.result.current.state).toBe('idle')
    })

    it('a create that was still in flight is dropped when it lands, its session cancelled, and nothing polls', async () => {
        const pending = deferred<ShakeSessionResponse>()
        mockCreateSession.mockReturnValueOnce(pending.promise)
        const hook = setup()

        const shake = await startShake(hook)
        await act(async () => {
            hook.result.current.stop()
        })
        expect(hook.result.current.state).toBe('idle')

        await act(async () => {
            pending.resolve(makeSession('s1', [ANA]))
            await shake.done
        })

        expect(hook.result.current.state).toBe('idle')
        expect(hook.result.current.candidates).toEqual([])
        expect(mockCancelSession).toHaveBeenCalledWith('s1')
        await advance(SHAKE_POLL_INTERVAL_MS * 5)
        expect(mockGetSession).not.toHaveBeenCalled()
    })

    it('a poll that was in flight cannot bring the search back to life', async () => {
        const latePoll = deferred<ShakeSessionResponse>()
        mockGetSession.mockReturnValueOnce(latePoll.promise)
        const hook = setup()
        await shakeNow(hook)
        await advance(SHAKE_POLL_INTERVAL_MS)
        await act(async () => {
            hook.result.current.stop()
        })

        await act(async () => {
            latePoll.resolve(makeSession('s1', [ANA, BOB]))
        })

        expect(hook.result.current.state).toBe('idle')
        expect(hook.result.current.candidates).toEqual([])
        await advance(SHAKE_POLL_INTERVAL_MS * 5)
        expect(mockGetSession).toHaveBeenCalledTimes(1)
    })

    it.each<ShakeSessionStatus>(['expired', 'cancelled'])(
        'a %s poll that was in flight cannot flip idle to expired',
        async (status) => {
            const latePoll = deferred<ShakeSessionResponse>()
            mockGetSession.mockReturnValueOnce(latePoll.promise)
            const hook = setup()
            await shakeNow(hook)
            await advance(SHAKE_POLL_INTERVAL_MS)
            await act(async () => {
                hook.result.current.stop()
            })

            await act(async () => {
                latePoll.resolve(makeSession('s1', [], status))
            })

            expect(hook.result.current.state).toBe('idle')
        }
    )

    it('a failing poll that was in flight cannot flip idle to error', async () => {
        const latePoll = deferred<ShakeSessionResponse>()
        mockGetSession.mockReturnValue(latePoll.promise)
        const hook = setup()
        await shakeNow(hook)
        await advance(SHAKE_POLL_INTERVAL_MS)
        await act(async () => {
            hook.result.current.stop()
        })

        await act(async () => {
            latePoll.reject(new Error('offline'))
        })

        expect(hook.result.current.state).toBe('idle')
    })

    it('a shake after stop() starts a fresh search', async () => {
        const hook = setup()
        await shakeNow(hook)
        await act(async () => {
            hook.result.current.stop()
        })

        await shakeNow(hook)

        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([ANA])
        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(mockGetSession).toHaveBeenLastCalledWith('s2')
    })
})

describe('useShakeSession: unmount', () => {
    it('cancels the current session once and stops polling', async () => {
        const hook = setup()
        await shakeNow(hook)
        await advance(SHAKE_POLL_INTERVAL_MS)
        const pollsBefore = mockGetSession.mock.calls.length

        hook.unmount()

        expect(mockCancelSession).toHaveBeenCalledTimes(1)
        expect(mockCancelSession).toHaveBeenCalledWith('s1')

        await advance(SHAKE_POLL_INTERVAL_MS * 10)
        expect(mockGetSession).toHaveBeenCalledTimes(pollsBefore)
        expect(mockCreateSession).toHaveBeenCalledTimes(1)
        expect(mockCancelSession).toHaveBeenCalledTimes(1)
    })

    it('with nothing running it makes no API call', async () => {
        const hook = setup()

        hook.unmount()
        await advance(SHAKE_POLL_INTERVAL_MS * 3)

        expect(mockCancelSession).not.toHaveBeenCalled()
        expect(mockCreateSession).not.toHaveBeenCalled()
        expect(mockGetSession).not.toHaveBeenCalled()
    })

    it('ignores a failed cancel', async () => {
        const rejection = TrackedRejection.of(new Error('cancel failed'))
        mockCancelSession.mockReturnValue(rejection)
        const hook = setup()
        await shakeNow(hook)

        hook.unmount()
        await advance(0)

        expect(mockCancelSession).toHaveBeenCalledWith('s1')
        expect(rejection.handled).toBe(true)
    })

    it('a create that lands after unmount is cancelled and never polled', async () => {
        const pending = deferred<ShakeSessionResponse>()
        mockCreateSession.mockReturnValueOnce(pending.promise)
        const hook = setup()
        const shake = await startShake(hook)

        hook.unmount()
        await act(async () => {
            pending.resolve(makeSession('s1', [ANA]))
            await shake.done
        })

        expect(mockCancelSession).toHaveBeenCalledWith('s1')
        await advance(SHAKE_POLL_INTERVAL_MS * 5)
        expect(mockGetSession).not.toHaveBeenCalled()
    })

    it('a poll that lands after unmount schedules nothing further', async () => {
        const latePoll = deferred<ShakeSessionResponse>()
        mockGetSession.mockReturnValueOnce(latePoll.promise)
        const hook = setup()
        await shakeNow(hook)
        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(mockGetSession).toHaveBeenCalledTimes(1)

        hook.unmount()
        await act(async () => {
            latePoll.resolve(makeSession('s1', [ANA, BOB]))
        })
        await advance(SHAKE_POLL_INTERVAL_MS * 5)

        expect(mockGetSession).toHaveBeenCalledTimes(1)
    })

    it('does not log React errors when a response lands after unmount', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const pending = deferred<ShakeSessionResponse>()
        mockCreateSession.mockReturnValueOnce(pending.promise)
        const hook = setup()
        const shake = await startShake(hook)

        hook.unmount()
        await act(async () => {
            pending.resolve(makeSession('s1', [ANA]))
            await shake.done
        })

        expect(consoleError).not.toHaveBeenCalled()
    })
})

describe('useShakeSession: tab visibility', () => {
    it('hiding the page behaves like stop(): cancels, goes idle, clears candidates, stops polling', async () => {
        const hook = setup()
        await shakeNow(hook)
        await advance(SHAKE_POLL_INTERVAL_MS)
        const pollsBefore = mockGetSession.mock.calls.length

        setVisibility('hidden')
        await fireVisibilityChange()

        expect(mockCancelSession).toHaveBeenCalledTimes(1)
        expect(mockCancelSession).toHaveBeenCalledWith('s1')
        expect(hook.result.current.state).toBe('idle')
        expect(hook.result.current.candidates).toEqual([])

        await advance(SHAKE_POLL_INTERVAL_MS * 10)
        expect(mockGetSession).toHaveBeenCalledTimes(pollsBefore)
    })

    it('the page becoming visible does not stop anything', async () => {
        const hook = setup()
        await shakeNow(hook)

        setVisibility('visible')
        await fireVisibilityChange()
        await advance(SHAKE_POLL_INTERVAL_MS)

        expect(mockCancelSession).not.toHaveBeenCalled()
        expect(hook.result.current.state).toBe('searching')
        expect(mockGetSession).toHaveBeenCalledTimes(1)
    })

    it('does not resume by itself when the page comes back', async () => {
        const hook = setup()
        await shakeNow(hook)
        setVisibility('hidden')
        await fireVisibilityChange()

        setVisibility('visible')
        await fireVisibilityChange()
        await advance(SHAKE_POLL_INTERVAL_MS * 5)

        expect(hook.result.current.state).toBe('idle')
        expect(mockCreateSession).toHaveBeenCalledTimes(1)
        expect(mockGetSession).not.toHaveBeenCalled()
    })

    it('hiding the page with nothing running makes no API call', async () => {
        setup()

        setVisibility('hidden')
        await fireVisibilityChange()

        expect(mockCancelSession).not.toHaveBeenCalled()
    })

    it('a create that was in flight when the page was hidden is dropped and cancelled', async () => {
        const pending = deferred<ShakeSessionResponse>()
        mockCreateSession.mockReturnValueOnce(pending.promise)
        const hook = setup()
        const shake = await startShake(hook)

        setVisibility('hidden')
        await fireVisibilityChange()
        await act(async () => {
            pending.resolve(makeSession('s1', [ANA]))
            await shake.done
        })

        expect(hook.result.current.state).toBe('idle')
        expect(mockCancelSession).toHaveBeenCalledWith('s1')
        await advance(SHAKE_POLL_INTERVAL_MS * 3)
        expect(mockGetSession).not.toHaveBeenCalled()
    })

    it('a new shake works after the page was hidden and shown again', async () => {
        const hook = setup()
        await shakeNow(hook)
        setVisibility('hidden')
        await fireVisibilityChange()
        setVisibility('visible')
        await fireVisibilityChange()

        await shakeNow(hook)

        expect(hook.result.current.state).toBe('searching')
        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(mockGetSession).toHaveBeenLastCalledWith('s2')
    })

    it('removes its visibility listener when it unmounts', () => {
        const added: Array<{ target: EventTarget; handler: unknown }> = []
        const removed: Array<{ target: EventTarget; handler: unknown }> = []
        for (const target of [document, window] as EventTarget[]) {
            const add = target.addEventListener.bind(target)
            const remove = target.removeEventListener.bind(target)
            jest.spyOn(target, 'addEventListener').mockImplementation((type, handler, options) => {
                if (type === 'visibilitychange') added.push({ target, handler })
                add(type, handler, options)
            })
            jest.spyOn(target, 'removeEventListener').mockImplementation((type, handler, options) => {
                if (type === 'visibilitychange') removed.push({ target, handler })
                remove(type, handler, options)
            })
        }

        const hook = setup()
        expect(added.length).toBeGreaterThan(0)
        hook.unmount()

        for (const listener of added) {
            expect(removed).toContainEqual(listener)
        }
    })
})

describe('useShakeSession: under React.StrictMode (effects set up, torn down and set up again)', () => {
    it('still searches, polls, and follows the server', async () => {
        mockGetSession.mockResolvedValue(makeSession('s1', [BOB]))
        const hook = setup({ strict: true })
        await shakeNow(hook, LOCATION)

        expect(hook.result.current.state).toBe('searching')
        expect(hook.result.current.candidates).toEqual([ANA])
        expect(mockCreateSession).toHaveBeenCalledTimes(1)

        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(hook.result.current.candidates).toEqual([BOB])
        expect(mockGetSession).toHaveBeenCalledTimes(1)
    })

    it('still ends in expired and error states', async () => {
        mockGetSession.mockResolvedValueOnce(makeSession('s1', [], 'expired'))
        const hook = setup({ strict: true })
        await shakeNow(hook)
        await advance(SHAKE_POLL_INTERVAL_MS)
        expect(hook.result.current.state).toBe('expired')

        mockCreateSession.mockRejectedValueOnce(new Error('offline'))
        await shakeNow(hook)
        expect(hook.result.current.state).toBe('error')
    })

    it('stop() and unmount still cancel the session', async () => {
        const hook = setup({ strict: true })
        await shakeNow(hook)

        await act(async () => {
            hook.result.current.stop()
        })
        expect(mockCancelSession).toHaveBeenCalledWith('s1')
        expect(hook.result.current.state).toBe('idle')

        await shakeNow(hook)
        hook.unmount()
        expect(mockCancelSession).toHaveBeenLastCalledWith('s2')
    })
})
