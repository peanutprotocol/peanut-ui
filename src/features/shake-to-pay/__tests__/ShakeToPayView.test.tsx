import { StrictMode } from 'react'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { sendUrl } from '@/utils/native-routes'
import { ShakeToPayView } from '../ShakeToPayView'
import type { ShakeCandidate, ShakeLocation } from '../shakeApi'
import type { ShakeSearchState } from '../useShakeSession'

// ---------------------------------------------------------------------------
// module mocks: everything the view talks to, so the view is tested on its own
// ---------------------------------------------------------------------------

type MotionStatus = 'unsupported' | 'needs-permission' | 'denied' | 'listening'
type LocationStatus = 'pending' | 'granted' | 'denied' | 'unavailable'

const mockPush = jest.fn()
const mockRouter = { push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }
jest.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
    usePathname: () => '/send',
    useSearchParams: () => new URLSearchParams('view=shake'),
}))

let mockShookValue: string | null = null
jest.mock('nuqs', () => ({
    ...jest.requireActual('nuqs'),
    useQueryState: (key: string) => [key === 'shook' ? mockShookValue : null, jest.fn()],
}))

let mockSession: {
    state: ShakeSearchState
    candidates: ShakeCandidate[]
    retryAfterSeconds: number | null
    shake: jest.Mock
    stop: jest.Mock
}
let mockUseRealSession = false
const mockEntryCreate = jest.fn()
const mockEntryGet = jest.fn()
const mockEntryCancel = jest.fn()
jest.mock('../shakeApi', () => ({
    shakeApi: {
        createSession: (...args: unknown[]) => mockEntryCreate(...args),
        getSession: (...args: unknown[]) => mockEntryGet(...args),
        cancelSession: (...args: unknown[]) => mockEntryCancel(...args),
    },
}))
jest.mock('../useShakeSession', () => ({
    useShakeSession: () =>
        mockUseRealSession ? jest.requireActual('../useShakeSession').useShakeSession() : mockSession,
}))

let mockMotion: { status: MotionStatus; requestPermission: jest.Mock }
let motionOptions: { onShake: () => void } | undefined
jest.mock('../useShakeMotion', () => ({
    useShakeMotion: (options: { onShake: () => void }) => {
        motionOptions = options
        return mockMotion
    },
}))

let mockLocation: { location: ShakeLocation | null; status: LocationStatus }
jest.mock('../useApproxLocation', () => ({ useApproxLocation: () => mockLocation }))

let mockContacts: Array<{ username: string }>
jest.mock('@/hooks/useContacts', () => ({ useContacts: () => ({ contacts: mockContacts }) }))

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        capture: (...args: unknown[]) => mockCapture(...args),
        isFeatureEnabled: () => true,
        getFeatureFlag: () => true,
    },
    capture: (...args: unknown[]) => mockCapture(...args),
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => {
        const { priority: _priority, fill: _fill, unoptimized: _unoptimized, ...rest } = props
        return require('react').createElement('img', rest)
    },
}))

// ---------------------------------------------------------------------------
// fixtures and helpers
// ---------------------------------------------------------------------------

const LOCATION: ShakeLocation = { latitude: 52.37, longitude: 4.895, accuracyM: 35 }

const candidate = (username: string, extra: Partial<ShakeCandidate> = {}): ShakeCandidate => ({
    username,
    displayName: null,
    avatarKey: null,
    isVerified: false,
    ...extra,
})

const ANA = candidate('ana', { displayName: 'Ana Gomez', avatarKey: 'letter.z', isVerified: true })
const BOB = candidate('bob')
const CARL = candidate('carl', { displayName: 'Carl Jones' })

const MOTION_STATUSES: MotionStatus[] = ['unsupported', 'needs-permission', 'denied', 'listening']
const SESSION_STATES: ShakeSearchState[] = ['idle', 'searching', 'done', 'no-match', 'expired', 'error', 'rate-limited']

const onPrev = jest.fn()
const renderView = () => renderWithIntl(<ShakeToPayView onPrev={onPrev} />)

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Exact-match the whole text of an element; tolerant only of typographic apostrophes and ellipses. */
const copy = (text: string) =>
    new RegExp(`^${escapeRegExp(text).replace(/'/g, "['’]").replace(/…/g, '(?:…|\\.\\.\\.)')}$`)

const COPY = {
    title: 'Shake to pay',
    instruction: 'Shake your phones at the same time',
    tap: 'Tap to find people',
    shakeAgain: 'Shake again',
    notHere: 'Not here? Shake again',
    cancel: 'Cancel',
    start: 'Start shaking',
    motionDenied: 'Motion access is off. Tap the button instead.',
    motionUnavailable: "This phone isn't reporting motion. Tap the button instead.",
    searching: 'Looking nearby…',
    empty: 'No one yet. Ask them to shake too.',
    noMatchTitle: 'No one found',
    noMatch: "Shake at the same moment as the person you're paying, then try again.",
    expiredTitle: 'Search ended',
    expired: 'Shake again to look for people.',
    errorTitle: "Couldn't reach Peanut",
    error: 'Check your connection and try again.',
    locationHint: 'Turn on location to find people near you more easily.',
    confirmRecipient: 'Tap a photo to pay. Check the @username first.',
}
const rateLimitedCopy = (seconds: number) => `Try again in ${seconds}s.`
const foundSearchingCopy = (count: number) => `${count} found, still looking`
const nearbyCopy = (count: number) => (count === 1 ? '1 person nearby' : `${count} people nearby`)
const ENDED_STATES: ShakeSearchState[] = ['no-match', 'expired', 'error', 'rate-limited']

const byText = (text: string) => screen.queryByText(copy(text))
const tapButton = () => screen.getByRole('button', { name: COPY.tap })
/** Whichever control starts a fresh search in the current state: ready, ended, or people shown. */
const RETRY_NAME = /^(Tap to find people|Shake again|Not here\? Shake again)$/
const retryButton = () => screen.getByRole('button', { name: RETRY_NAME })
const payButton = (name: string) => screen.getByRole('button', { name: `Pay ${name}` })
const payButtons = () => screen.queryAllByRole('button', { name: /^Pay / })

/** Which of the state messages are on screen, so a state can be checked to show exactly its own. */
function shownStateMessages(): string[] {
    const shown: string[] = []
    if (byText(COPY.searching)) shown.push('searching')
    if (byText(COPY.empty)) shown.push('empty')
    if (byText(COPY.noMatchTitle)) shown.push('no-match')
    if (byText(COPY.expiredTitle)) shown.push('expired')
    if (byText(COPY.errorTitle)) shown.push('error')
    if (screen.queryByText(/^Too many shakes$/)) shown.push('rate-limited')
    return shown
}

const elementCount = (root: HTMLElement) => root.querySelectorAll('*').length

/** A badge is either labelled "verified" or adds markup the same card does not have without it. */
const hasLabelledVerifiedBadge = (root: HTMLElement) =>
    [root, ...Array.from(root.querySelectorAll<HTMLElement | SVGElement>('*'))].some((el) =>
        [
            el.getAttribute('aria-label'),
            el.getAttribute('title'),
            el.getAttribute('alt'),
            el.getAttribute('data-testid'),
        ].some((value) => !!value && /verified/i.test(value))
    )

const triggerShake = () =>
    act(() => {
        motionOptions!.onShake()
    })

beforeEach(() => {
    jest.useFakeTimers()
    mockShookValue = null
    mockUseRealSession = false
    const response = {
        sessionId: 'entry-session',
        shakenAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 90000).toISOString(),
        status: 'active',
        candidates: [],
    }
    mockEntryCreate.mockReset().mockResolvedValue(response)
    mockEntryGet.mockReset().mockResolvedValue(response)
    mockEntryCancel.mockReset().mockResolvedValue(undefined)
    mockPush.mockReset()
    mockCapture.mockReset()
    onPrev.mockReset()
    motionOptions = undefined
    mockSession = { state: 'idle', candidates: [], retryAfterSeconds: null, shake: jest.fn(), stop: jest.fn() }
    mockMotion = { status: 'listening', requestPermission: jest.fn().mockResolvedValue(undefined) }
    mockLocation = { location: null, status: 'pending' }
    mockContacts = []
})

afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    Reflect.deleteProperty(document, 'visibilityState')
    Reflect.deleteProperty(document, 'hidden')
    Reflect.deleteProperty(window, 'Capacitor')
})

// ---------------------------------------------------------------------------

describe('ShakeToPayView: header and instruction', () => {
    it('shows the title, and the instruction only once the automatic search has run and nothing is going on', async () => {
        mockLocation = { location: LOCATION, status: 'granted' }
        renderView()

        expect(screen.getAllByText(COPY.title).length).toBeGreaterThanOrEqual(1)
        expect(byText(COPY.instruction)).not.toBeInTheDocument()
        await advanceEntry(0)
        expect(byText(COPY.instruction)).toBeInTheDocument()
        expect(tapButton()).toBeInTheDocument()
    })

    it.each(SESSION_STATES)('keeps the title in the %s state', (state) => {
        mockSession.state = state
        mockSession.retryAfterSeconds = state === 'rate-limited' ? 10 : null
        renderView()

        expect(screen.getAllByText(COPY.title).length).toBeGreaterThanOrEqual(1)
    })

    it.each(MOTION_STATUSES)('waits for pending location before automatic entry search (motion %s)', (status) => {
        mockMotion.status = status
        renderView()

        expect(mockSession.shake).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })
})

describe('ShakeToPayView: the tap fallback', () => {
    const ended = MOTION_STATUSES.flatMap((motion) => ENDED_STATES.map((state) => [motion, state] as const))
    const withPeople = MOTION_STATUSES.flatMap((motion) =>
        (['searching', 'done'] as const).map((state) => [motion, state] as const)
    )

    it.each(ended)('"Shake again" is there once the search has ended (motion %s, search %s)', (motion, state) => {
        mockMotion.status = motion
        mockSession.state = state
        mockSession.retryAfterSeconds = state === 'rate-limited' ? 10 : null
        renderView()

        expect(screen.getByRole('button', { name: COPY.shakeAgain })).toBeEnabled()
    })

    it.each(withPeople)(
        '"Not here? Shake again" is there while people are shown (motion %s, search %s)',
        (motion, state) => {
            mockMotion.status = motion
            mockSession.state = state
            mockSession.candidates = [ANA]
            renderView()

            expect(screen.getByRole('button', { name: COPY.notHere })).toBeInTheDocument()
        }
    )

    it('while still looking with nobody yet, offers Cancel and no second search', () => {
        mockSession.state = 'searching'
        renderView()

        expect(screen.getByRole('button', { name: COPY.cancel })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: RETRY_NAME })).not.toBeInTheDocument()
    })

    it('Cancel stops the search, then leaves', () => {
        mockSession.state = 'searching'
        renderView()

        fireEvent.click(screen.getByRole('button', { name: COPY.cancel }))

        expect(mockSession.stop).toHaveBeenCalledTimes(1)
        expect(onPrev).toHaveBeenCalledTimes(1)
        expect(mockSession.shake).not.toHaveBeenCalled()
    })

    it('starts a search with the current location', async () => {
        mockLocation = { location: LOCATION, status: 'granted' }
        renderView()
        await advanceEntry(0)

        fireEvent.click(tapButton())

        expect(mockSession.shake).toHaveBeenCalledTimes(2)
        expect(mockSession.shake).toHaveBeenNthCalledWith(1, LOCATION)
        expect(mockSession.shake).toHaveBeenNthCalledWith(2, LOCATION)
    })

    it.each<LocationStatus>(['pending', 'denied', 'unavailable'])(
        'starts a search with null when there is no location (location %s)',
        async (status) => {
            mockLocation = { location: null, status }
            mockSession.state = 'no-match'
            renderView()
            await advanceEntry(0)

            fireEvent.click(retryButton())

            expect(mockSession.shake).toHaveBeenCalledTimes(status === 'pending' ? 1 : 2)
            expect(mockSession.shake).toHaveBeenLastCalledWith(null)
        }
    )

    it('uses the location as it is now, not as it was at first render', () => {
        mockSession.state = 'no-match'
        const { rerender } = renderView()
        mockLocation = { location: LOCATION, status: 'granted' }
        rerender(<ShakeToPayView onPrev={onPrev} />)

        fireEvent.click(retryButton())

        expect(mockSession.shake).toHaveBeenCalledWith(LOCATION)
    })

    it('works with no accelerometer at all', () => {
        mockMotion.status = 'unsupported'
        mockSession.state = 'no-match'
        renderView()

        fireEvent.click(retryButton())

        expect(mockSession.shake).toHaveBeenCalledTimes(1)
    })

    it('can search again and again while people are shown', () => {
        mockSession.state = 'searching'
        mockSession.candidates = [ANA]
        renderView()

        fireEvent.click(retryButton())
        fireEvent.click(retryButton())

        expect(mockSession.shake).toHaveBeenCalledTimes(2)
    })

    it('does not leave the screen', () => {
        mockSession.state = 'no-match'
        renderView()

        fireEvent.click(retryButton())

        expect(onPrev).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })
})

describe('ShakeToPayView: motion permission', () => {
    it('needs-permission: a "Start shaking" button asks for permission, and nothing else happens yet', async () => {
        mockMotion.status = 'needs-permission'
        renderView()

        fireEvent.click(screen.getByRole('button', { name: COPY.start }))
        await act(async () => {
            await Promise.resolve()
        })

        expect(mockMotion.requestPermission).toHaveBeenCalledTimes(1)
        expect(mockSession.shake).not.toHaveBeenCalled()
        expect(byText(COPY.motionDenied)).not.toBeInTheDocument()
    })

    it.each<MotionStatus>(['unsupported', 'denied', 'listening'])(
        '%s: there is no "Start shaking" button',
        (status) => {
            mockMotion.status = status
            renderView()

            expect(screen.queryByRole('button', { name: COPY.start })).not.toBeInTheDocument()
        }
    )

    it('denied: says motion access is off and points at the button', () => {
        mockMotion.status = 'denied'
        mockSession.state = 'no-match'
        renderView()

        expect(byText(COPY.motionDenied)).toBeInTheDocument()
        expect(retryButton()).toBeInTheDocument()
    })

    it.each<MotionStatus>(['unsupported', 'needs-permission', 'listening'])(
        '%s: the "motion access is off" line is not shown',
        (status) => {
            mockMotion.status = status
            renderView()

            expect(byText(COPY.motionDenied)).not.toBeInTheDocument()
        }
    )

    it('the permission button does not run a search by itself', () => {
        mockMotion.status = 'needs-permission'
        renderView()

        fireEvent.click(screen.getByRole('button', { name: COPY.start }))

        expect(mockSession.shake).not.toHaveBeenCalled()
    })
})

describe('ShakeToPayView: a detected shake', () => {
    it('hands the motion hook an onShake callback', () => {
        renderView()

        expect(motionOptions).toBeDefined()
        expect(typeof motionOptions!.onShake).toBe('function')
    })

    it('starts a search with the current location, like the tap', async () => {
        mockLocation = { location: LOCATION, status: 'granted' }
        renderView()
        await advanceEntry(0)

        triggerShake()

        expect(mockSession.shake).toHaveBeenCalledTimes(2)
        expect(mockSession.shake).toHaveBeenNthCalledWith(1, LOCATION)
        expect(mockSession.shake).toHaveBeenNthCalledWith(2, LOCATION)
    })

    it('starts a search with null when there is no location', () => {
        renderView()

        triggerShake()

        expect(mockSession.shake).toHaveBeenCalledTimes(1)
        expect(mockSession.shake).toHaveBeenCalledWith(null)
    })

    it('uses the latest location, not the one from the first render', () => {
        const { rerender } = renderView()
        mockLocation = { location: LOCATION, status: 'granted' }
        rerender(<ShakeToPayView onPrev={onPrev} />)

        triggerShake()

        expect(mockSession.shake).toHaveBeenCalledWith(LOCATION)
    })

    it.each(SESSION_STATES)('a shake in the %s state still starts a search', (state) => {
        mockSession.state = state
        mockSession.retryAfterSeconds = state === 'rate-limited' ? 10 : null
        renderView()

        triggerShake()

        expect(mockSession.shake).toHaveBeenCalledTimes(1)
    })

    it('every detected shake is passed on: two shakes, two searches', () => {
        renderView()

        triggerShake()
        triggerShake()

        expect(mockSession.shake).toHaveBeenCalledTimes(2)
    })

    it('does not leave the screen', () => {
        renderView()

        triggerShake()

        expect(onPrev).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })
})

describe('ShakeToPayView: search states', () => {
    it('idle on first paint: shows searching while the entry search waits for location', () => {
        renderView()

        expect(byText(COPY.searching)).toBeInTheDocument()
        expect(byText(COPY.empty)).toBeInTheDocument()
        expect(payButtons()).toHaveLength(0)
    })

    it('searching with nobody yet: "Looking nearby…" and "No one yet. Ask them to shake too."', () => {
        mockSession.state = 'searching'
        renderView()

        expect(shownStateMessages()).toEqual(['searching', 'empty'])
        expect(payButtons()).toHaveLength(0)
    })

    it('searching with people: "2 found, still looking", the photo prompt, and no "No one yet"', () => {
        mockSession.state = 'searching'
        mockSession.candidates = [ANA, BOB]
        renderView()

        expect(byText(foundSearchingCopy(2))).toBeInTheDocument()
        expect(byText(COPY.confirmRecipient)).toBeInTheDocument()
        expect(shownStateMessages()).toEqual([])
        expect(payButtons()).toHaveLength(2)
    })

    it('expired: "Search ended" and "Shake again to look for people."', () => {
        mockSession.state = 'expired'
        renderView()

        expect(shownStateMessages()).toEqual(['expired'])
        expect(byText(COPY.expired)).toBeInTheDocument()
        expect(payButtons()).toHaveLength(0)
    })

    it('error: "Couldn\'t reach Peanut" and "Check your connection and try again."', () => {
        mockSession.state = 'error'
        renderView()

        expect(shownStateMessages()).toEqual(['error'])
        expect(byText(COPY.error)).toBeInTheDocument()
        expect(payButtons()).toHaveLength(0)
    })

    it.each([1, 12, 45, 600])('rate-limited: "Too many shakes" and "Try again in %is."', (seconds) => {
        mockSession.state = 'rate-limited'
        mockSession.retryAfterSeconds = seconds
        renderView()

        expect(screen.getByText(copy(rateLimitedCopy(seconds)))).toBeInTheDocument()
        expect(shownStateMessages()).toEqual(['rate-limited'])
        expect(payButtons()).toHaveLength(0)
    })

    it('rate-limited with no retry time never prints null, undefined or NaN', () => {
        mockSession.state = 'rate-limited'
        mockSession.retryAfterSeconds = null
        const { container } = renderView()

        expect(container.textContent).not.toMatch(/null|undefined|NaN/)
        expect(screen.getByText(/^Too many shakes/)).toBeInTheDocument()
    })

    it('rerenders from one state to the next', () => {
        mockSession.state = 'searching'
        mockSession.candidates = [ANA]
        const { rerender } = renderView()
        expect(byText(foundSearchingCopy(1))).toBeInTheDocument()

        mockSession.state = 'expired'
        mockSession.candidates = []
        rerender(<ShakeToPayView onPrev={onPrev} />)
        expect(shownStateMessages()).toEqual(['expired'])
        expect(payButtons()).toHaveLength(0)

        mockSession.state = 'searching'
        mockSession.candidates = [BOB]
        rerender(<ShakeToPayView onPrev={onPrev} />)
        expect(byText(foundSearchingCopy(1))).toBeInTheDocument()
        expect(payButtons()).toHaveLength(1)
    })
})

describe('ShakeToPayView: location hint', () => {
    it.each<LocationStatus>(['denied', 'unavailable'])('shows the hint when location is %s', async (status) => {
        mockLocation = { location: null, status }
        renderView()
        await advanceEntry(0)

        expect(byText(COPY.locationHint)).toBeInTheDocument()
    })

    it.each<LocationStatus>(['pending', 'granted'])('does not show the hint when location is %s', async (status) => {
        mockLocation = { location: status === 'granted' ? LOCATION : null, status }
        renderView()
        await advanceEntry(0)

        expect(byText(COPY.locationHint)).not.toBeInTheDocument()
    })

    it.each<ShakeSearchState>(['searching', 'expired', 'error'])('keeps showing the hint while %s', async (state) => {
        mockLocation = { location: null, status: 'denied' }
        mockSession.state = state
        renderView()
        await advanceEntry(0)

        expect(byText(COPY.locationHint)).toBeInTheDocument()
    })

    it('does not block searching: the tap still works without a location', () => {
        mockLocation = { location: null, status: 'denied' }
        mockSession.state = 'no-match'
        renderView()

        fireEvent.click(retryButton())

        expect(mockSession.shake).toHaveBeenCalledWith(null)
    })

    it('never prints the coordinates', async () => {
        mockLocation = { location: LOCATION, status: 'granted' }
        mockSession.state = 'searching'
        mockSession.candidates = [ANA]
        const { container } = renderView()
        await advanceEntry(0)

        expect(container.textContent).not.toContain('52.37')
        expect(container.textContent).not.toContain('4.895')
    })
})

describe('ShakeToPayView: people nearby', () => {
    beforeEach(() => {
        mockSession.state = 'searching'
    })

    it('has one button per candidate, named "Pay <name>" with the display name when there is one', () => {
        mockSession.candidates = [ANA, CARL]
        renderView()

        expect(payButtons()).toHaveLength(2)
        expect(payButton('Ana Gomez')).toBeInTheDocument()
        expect(payButton('Carl Jones')).toBeInTheDocument()
    })

    it('falls back to "Pay @username" when the candidate has no display name', () => {
        mockSession.candidates = [BOB]
        renderView()

        expect(payButton('@bob')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Pay bob' })).not.toBeInTheDocument()
    })

    it('does not use the @username in the name when a display name exists', () => {
        mockSession.candidates = [ANA]
        renderView()

        expect(screen.queryByRole('button', { name: 'Pay @ana' })).not.toBeInTheDocument()
    })

    it('keeps the order the server ranked them in', () => {
        mockSession.candidates = [CARL, BOB, ANA]
        renderView()

        expect(payButtons().map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual([
            'Pay Carl Jones',
            'Pay @bob',
            'Pay Ana Gomez',
        ])
    })

    it.each([ANA, BOB, CARL])('each card shows the @username ($username)', (person) => {
        mockSession.candidates = [person]
        renderView()

        const button = payButton(person.displayName ?? `@${person.username}`)
        expect(within(button).getByText(`@${person.username}`)).toBeInTheDocument()
    })

    it('each card shows an avatar, and it is the one the candidate picked', () => {
        const plain = candidate('ana', { displayName: 'Plain Ana' })
        const picked = candidate('amy', { displayName: 'Picked Ana', avatarKey: 'letter.z' })
        const samePick = candidate('bob', { displayName: 'Same Pick', avatarKey: 'letter.z' })
        mockSession.candidates = [plain, picked, samePick]
        renderView()

        const srcOf = (name: string) => payButton(name).querySelector('img')?.getAttribute('src')
        expect(srcOf('Plain Ana')).toBeTruthy()
        expect(srcOf('Picked Ana')).toBeTruthy()
        expect(srcOf('Picked Ana')).not.toBe(srcOf('Plain Ana'))
        expect(srcOf('Same Pick')).toBe(srcOf('Picked Ana'))
    })

    it('shows a verified badge when the candidate is verified, and not when they are not', () => {
        mockSession.candidates = [{ ...ANA, isVerified: true }]
        const { rerender } = renderView()
        const verifiedButton = payButton('Ana Gomez')
        const verifiedCount = elementCount(verifiedButton)
        const labelled = hasLabelledVerifiedBadge(verifiedButton)

        mockSession.candidates = [{ ...ANA, isVerified: false }]
        rerender(<ShakeToPayView onPrev={onPrev} />)
        const plainButton = payButton('Ana Gomez')

        expect(labelled || verifiedCount > elementCount(plainButton)).toBe(true)
        expect(hasLabelledVerifiedBadge(plainButton)).toBe(false)
    })

    it('an unverified candidate never gets the badge markup a verified one gets', () => {
        mockSession.candidates = [
            candidate('amy', { displayName: 'Same Name', isVerified: true }),
            candidate('ann', { displayName: 'Same Name', isVerified: false }),
        ]
        renderView()

        const [verifiedCard, plainCard] = screen.getAllByRole('button', { name: 'Pay Same Name' })
        expect(elementCount(verifiedCard)).toBeGreaterThan(elementCount(plainCard))
    })

    it('shows a "Contact" label on candidates who are in the contacts, and only on them', () => {
        mockContacts = [{ username: 'ana' }, { username: 'someone-else' }]
        mockSession.candidates = [ANA, BOB, CARL]
        renderView()

        expect(within(payButton('Ana Gomez')).getByText('Contact')).toBeInTheDocument()
        expect(within(payButton('@bob')).queryByText('Contact')).not.toBeInTheDocument()
        expect(within(payButton('Carl Jones')).queryByText('Contact')).not.toBeInTheDocument()
        expect(screen.getAllByText('Contact')).toHaveLength(1)
    })

    it('shows no "Contact" label when there are no contacts', () => {
        mockContacts = []
        mockSession.candidates = [ANA, BOB]
        renderView()

        expect(screen.queryByText('Contact')).not.toBeInTheDocument()
    })

    it('a verified contact shows the label next to the @username', () => {
        mockContacts = [{ username: 'ana' }]
        mockSession.candidates = [ANA]
        renderView()

        const button = payButton('Ana Gomez')
        expect(within(button).getByText('Contact')).toBeInTheDocument()
        expect(within(button).getByText('@ana')).toBeInTheDocument()
    })

    it('keeps the list in step with the session: a candidate that went away is gone', () => {
        mockSession.candidates = [ANA, BOB]
        const { rerender } = renderView()
        expect(payButtons()).toHaveLength(2)

        mockSession.candidates = [BOB]
        rerender(<ShakeToPayView onPrev={onPrev} />)

        expect(payButtons()).toHaveLength(1)
        expect(screen.queryByRole('button', { name: 'Pay Ana Gomez' })).not.toBeInTheDocument()
    })
})

describe('ShakeToPayView: choosing someone', () => {
    beforeEach(() => {
        mockSession.state = 'searching'
        mockSession.candidates = [ANA, BOB]
    })

    it('stops the search, then goes to the send flow for that username', () => {
        renderView()

        fireEvent.click(payButton('Ana Gomez'))

        expect(mockSession.stop).toHaveBeenCalledTimes(1)
        expect(mockPush).toHaveBeenCalledTimes(1)
        expect(mockPush).toHaveBeenCalledWith(sendUrl('ana'))
        expect(mockSession.stop.mock.invocationCallOrder[0]).toBeLessThan(mockPush.mock.invocationCallOrder[0])
    })

    it('goes to the username of the card that was tapped', () => {
        renderView()

        fireEvent.click(payButton('@bob'))

        expect(mockPush).toHaveBeenCalledWith(sendUrl('bob'))
        expect(mockPush).not.toHaveBeenCalledWith(sendUrl('ana'))
    })

    it('uses the app-wide send url, which differs on native (not a hand-built path)', () => {
        Object.defineProperty(window, 'Capacitor', {
            configurable: true,
            value: { isNativePlatform: () => true },
        })
        renderView()

        fireEvent.click(payButton('@bob'))

        expect(sendUrl('bob')).toBe('/send?recipient=bob')
        expect(mockPush).toHaveBeenCalledWith('/send?recipient=bob')
    })

    it('does not start a new search or leave through back', () => {
        renderView()

        fireEvent.click(payButton('Ana Gomez'))

        expect(mockSession.shake).not.toHaveBeenCalled()
        expect(onPrev).not.toHaveBeenCalled()
    })

    it('does not navigate until someone is tapped', () => {
        renderView()

        expect(mockPush).not.toHaveBeenCalled()
    })
})

describe('ShakeToPayView: back', () => {
    it('stops the search first, then calls onPrev', () => {
        mockSession.state = 'searching'
        mockSession.candidates = [ANA]
        renderView()

        fireEvent.click(screen.getByRole('button', { name: 'Back' }))

        expect(mockSession.stop).toHaveBeenCalledTimes(1)
        expect(onPrev).toHaveBeenCalledTimes(1)
        expect(mockSession.stop.mock.invocationCallOrder[0]).toBeLessThan(onPrev.mock.invocationCallOrder[0])
        expect(mockPush).not.toHaveBeenCalled()
        expect(mockSession.shake).not.toHaveBeenCalled()
    })

    it.each(SESSION_STATES)('works from the %s state', (state) => {
        mockSession.state = state
        mockSession.retryAfterSeconds = state === 'rate-limited' ? 10 : null
        renderView()

        fireEvent.click(screen.getByRole('button', { name: 'Back' }))

        expect(mockSession.stop).toHaveBeenCalledTimes(1)
        expect(onPrev).toHaveBeenCalledTimes(1)
    })
})

describe('ShakeToPayView: privacy', () => {
    const PRIVATE = candidate('zq_unique_user', { displayName: 'Zed Qwertyson', avatarKey: 'letter.q' })

    it('analytics events carry no coordinates, usernames or names', () => {
        mockLocation = { location: LOCATION, status: 'granted' }
        mockMotion.status = 'needs-permission'
        mockSession.state = 'searching'
        mockSession.candidates = [PRIVATE]
        mockContacts = [{ username: 'zq_unique_user' }]
        renderView()

        fireEvent.click(screen.getByRole('button', { name: COPY.start }))
        fireEvent.click(retryButton())
        triggerShake()
        fireEvent.click(payButton('Zed Qwertyson'))
        fireEvent.click(screen.getByRole('button', { name: 'Back' }))

        const sent = JSON.stringify(mockCapture.mock.calls)
        for (const secret of ['52.37', '4.895', 'zq_unique_user', 'Zed Qwertyson', 'latitude', 'longitude']) {
            expect(sent).not.toContain(secret)
        }
    })

    it('does not put the coordinates anywhere in the page', async () => {
        mockLocation = { location: LOCATION, status: 'granted' }
        mockSession.state = 'searching'
        mockSession.candidates = [PRIVATE]
        const { container } = renderView()
        await advanceEntry(0)

        expect(container.innerHTML).not.toContain('52.37')
        expect(container.innerHTML).not.toContain('4.895')
    })
})

// review finding (ui#3148): matching can still list someone who did not share a location,
// so the list asks the payer to confirm the recipient
describe('ShakeToPayView: confirming the recipient', () => {
    it('asks the payer to check the @username whenever people are listed', () => {
        mockSession.state = 'searching'
        mockSession.candidates = [ANA, BOB]
        renderView()
        expect(byText(COPY.confirmRecipient)).toBeInTheDocument()
    })

    it('does not show the prompt while no one is listed', () => {
        mockSession.state = 'searching'
        mockSession.candidates = []
        renderView()
        expect(byText(COPY.confirmRecipient)).not.toBeInTheDocument()
    })
})

// a phone that never delivers motion events must say so instead of silently ignoring shakes
describe('ShakeToPayView: no motion sensor', () => {
    it('points to the tap button when the phone reports no motion', () => {
        mockMotion.status = 'unsupported'
        mockSession.state = 'no-match'
        renderView()
        expect(byText(COPY.motionUnavailable)).toBeInTheDocument()
        expect(retryButton()).toBeInTheDocument()
    })

    it.each(['listening', 'needs-permission', 'denied'] as const)(
        'does not show the hint while motion is %s',
        (status) => {
            mockMotion.status = status
            renderView()
            expect(byText(COPY.motionUnavailable)).not.toBeInTheDocument()
        }
    )
})

const advanceEntry = (ms: number) =>
    act(async () => {
        await jest.advanceTimersByTimeAsync(ms)
    })
const shakeEvents = () => mockCapture.mock.calls.filter(([event]) => event === 'shake_to_pay_shake')
const matchedEvents = () => mockCapture.mock.calls.filter(([event]) => event === 'shake_to_pay_matched')

describe('ShakeToPayView: automatic entry search', () => {
    it.each<LocationStatus>(['granted', 'denied', 'unavailable'])(
        'starts once immediately when location is already %s',
        async (status) => {
            mockLocation = { status, location: status === 'granted' ? LOCATION : null }
            const { rerender } = renderView()
            await advanceEntry(0)
            expect(mockSession.shake.mock.calls).toEqual([[mockLocation.location]])
            expect(shakeEvents()).toEqual([
                ['shake_to_pay_shake', { method: 'entry', has_location: status === 'granted' }],
            ])
            rerender(<ShakeToPayView onPrev={onPrev} />)
            await advanceEntry(5000)
            expect(mockSession.shake).toHaveBeenCalledTimes(1)
        }
    )

    it('shows searching and waits exactly 2000ms when location remains pending', async () => {
        renderView()
        expect(byText(COPY.searching)).toBeInTheDocument()
        expect(mockSession.shake).not.toHaveBeenCalled()
        await advanceEntry(1999)
        expect(mockSession.shake).not.toHaveBeenCalled()
        await advanceEntry(1)
        expect(mockSession.shake.mock.calls).toEqual([[null]])
        expect(shakeEvents()).toEqual([['shake_to_pay_shake', { method: 'entry', has_location: false }]])
    })

    it.each<LocationStatus>(['granted', 'denied', 'unavailable'])(
        'uses location settling as %s before the timeout, once',
        async (status) => {
            const { rerender } = renderView()
            await advanceEntry(1000)
            mockLocation = { status, location: status === 'granted' ? LOCATION : null }
            rerender(<ShakeToPayView onPrev={onPrev} />)
            await advanceEntry(0)
            expect(mockSession.shake.mock.calls).toEqual([[mockLocation.location]])
            await advanceEntry(3000)
            expect(mockSession.shake).toHaveBeenCalledTimes(1)
        }
    )

    it('does not reset the mount timeout when a pending location object changes', async () => {
        const { rerender } = renderView()
        await advanceEntry(1500)
        mockLocation = { status: 'pending', location: null }
        rerender(<ShakeToPayView onPrev={onPrev} />)
        await advanceEntry(499)
        expect(mockSession.shake).not.toHaveBeenCalled()
        await advanceEntry(1)
        expect(mockSession.shake.mock.calls).toEqual([[null]])
    })

    it('uses the current coarse location at timeout even if status is still pending', async () => {
        const { rerender } = renderView()
        await advanceEntry(1000)
        mockLocation = { status: 'pending', location: LOCATION }
        rerender(<ShakeToPayView onPrev={onPrev} />)
        await advanceEntry(1000)
        expect(mockSession.shake.mock.calls).toEqual([[LOCATION]])
        expect(shakeEvents()).toEqual([['shake_to_pay_shake', { method: 'entry', has_location: true }]])
    })

    it('never duplicates an entry search when location settles after timeout', async () => {
        const { rerender } = renderView()
        await advanceEntry(2000)
        expect(mockSession.shake.mock.calls).toEqual([[null]])
        mockLocation = { status: 'granted', location: LOCATION }
        rerender(<ShakeToPayView onPrev={onPrev} />)
        rerender(<ShakeToPayView onPrev={onPrev} />)
        await advanceEntry(5000)
        expect(mockSession.shake).toHaveBeenCalledTimes(1)
        expect(shakeEvents()).toHaveLength(1)
    })

    it.each(['settlement first', 'timeout first'] as const)(
        'starts once if location and timeout are ready at the boundary: %s',
        async (order) => {
            const { rerender } = renderView()
            await advanceEntry(1999)
            if (order === 'timeout first') await advanceEntry(1)
            else jest.setSystemTime(Date.now() + 1)
            mockLocation = { status: 'granted', location: LOCATION }
            rerender(<ShakeToPayView onPrev={onPrev} />)
            await advanceEntry(1)
            expect(mockSession.shake.mock.calls).toEqual([[order === 'timeout first' ? null : LOCATION]])
            expect(shakeEvents()).toHaveLength(1)
        }
    )

    it.each(['pending', 'granted'] as const)('StrictMode starts once when location is %s', async (status) => {
        mockLocation = { status, location: status === 'granted' ? LOCATION : null }
        renderWithIntl(
            <StrictMode>
                <ShakeToPayView onPrev={onPrev} />
            </StrictMode>
        )
        await advanceEntry(5000)
        expect(mockSession.shake.mock.calls).toEqual([[mockLocation.location]])
        expect(shakeEvents()).toHaveLength(1)
    })

    it('a new mount gets a new automatic entry search', async () => {
        mockLocation = { status: 'granted', location: LOCATION }
        const first = renderView()
        await advanceEntry(0)
        expect(mockSession.shake).toHaveBeenCalledTimes(1)
        first.unmount()
        renderView()
        await advanceEntry(0)
        expect(mockSession.shake).toHaveBeenCalledTimes(2)
    })

    // only motion can arrive while the entry search waits: the screen offers no tap until it has run
    it('a shake while waiting consumes pending automatic entry', async () => {
        const { rerender } = renderView()
        await advanceEntry(500)
        triggerShake()
        expect(mockSession.shake.mock.calls).toEqual([[null]])
        mockLocation = { status: 'granted', location: LOCATION }
        rerender(<ShakeToPayView onPrev={onPrev} />)
        await advanceEntry(5000)
        expect(mockSession.shake).toHaveBeenCalledTimes(1)
        expect(shakeEvents()).toEqual([['shake_to_pay_shake', { method: 'motion', has_location: false }]])
    })

    it.each(['unmount', 'back', 'select'] as const)('cancels pending entry on %s', async (action) => {
        if (action === 'select') {
            mockSession.state = 'done'
            mockSession.candidates = [ANA]
        }
        const { unmount, rerender } = renderView()
        if (action === 'unmount') unmount()
        else if (action === 'back') fireEvent.click(screen.getByRole('button', { name: 'Back' }))
        else fireEvent.click(payButton('Ana Gomez'))
        await advanceEntry(5000)
        if (action !== 'unmount') {
            mockLocation = { status: 'granted', location: LOCATION }
            rerender(<ShakeToPayView onPrev={onPrev} />)
        }
        expect(mockSession.shake).not.toHaveBeenCalled()
        expect(shakeEvents()).toHaveLength(0)
    })

    it('backgrounding while entry is pending prevents a hidden search and automatic resumption', async () => {
        const { rerender } = renderView()
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
        Object.defineProperty(document, 'hidden', { configurable: true, value: true })
        act(() => document.dispatchEvent(new Event('visibilitychange')))
        await advanceEntry(2000)
        expect(mockSession.shake).not.toHaveBeenCalled()
        mockLocation = { status: 'granted', location: LOCATION }
        rerender(<ShakeToPayView onPrev={onPrev} />)
        expect(mockSession.shake).not.toHaveBeenCalled()
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
        Object.defineProperty(document, 'hidden', { configurable: true, value: false })
        act(() => document.dispatchEvent(new Event('visibilitychange')))
        await advanceEntry(3000)
        expect(mockSession.shake).not.toHaveBeenCalled()
        expect(shakeEvents()).toHaveLength(0)
    })

    it.each([
        { query: '1', method: 'home_shake' },
        { query: null, method: 'entry' },
        { query: '0', method: 'entry' },
        { query: 'true', method: 'entry' },
        { query: '', method: 'entry' },
    ])('attributes automatic entry with shook=$query to $method', async ({ query, method }) => {
        mockShookValue = query
        mockLocation = { status: 'granted', location: LOCATION }
        renderView()
        await advanceEntry(0)
        expect(shakeEvents()).toEqual([['shake_to_pay_shake', { method, has_location: true }]])
    })

    it('keeps later tap and motion analytics distinct from home shake entry and uses current location', async () => {
        mockShookValue = '1'
        mockLocation = { status: 'granted', location: LOCATION }
        const { rerender } = renderView()
        await advanceEntry(0)
        fireEvent.click(tapButton())
        mockLocation = { status: 'denied', location: null }
        rerender(<ShakeToPayView onPrev={onPrev} />)
        triggerShake()
        expect(shakeEvents()).toEqual([
            ['shake_to_pay_shake', { method: 'home_shake', has_location: true }],
            ['shake_to_pay_shake', { method: 'tap', has_location: true }],
            ['shake_to_pay_shake', { method: 'motion', has_location: false }],
        ])
    })
})

describe('ShakeToPayView: finished look window', () => {
    it('done keeps candidates tappable without searching copy or a spinner', () => {
        mockSession.state = 'done'
        mockSession.candidates = [ANA, BOB]
        const { container } = renderView()
        expect(shownStateMessages()).toEqual([])
        expect(byText(nearbyCopy(2))).toBeInTheDocument()
        expect(byText(COPY.confirmRecipient)).toBeInTheDocument()
        expect(payButtons()).toHaveLength(2)
        expect(container.querySelector('[class*="animate-spin"]')).not.toBeInTheDocument()
        fireEvent.click(payButton('@bob'))
        expect(mockSession.stop).toHaveBeenCalledTimes(1)
        expect(mockPush).toHaveBeenCalledWith(sendUrl('bob'))
        expect(mockSession.stop.mock.invocationCallOrder[0]).toBeLessThan(mockPush.mock.invocationCallOrder[0])
    })

    it('no-match displays the retry guidance, without candidates or spinner', () => {
        mockSession.state = 'no-match'
        const { container } = renderView()
        expect(shownStateMessages()).toEqual(['no-match'])
        expect(byText(COPY.noMatch)).toBeInTheDocument()
        expect(payButtons()).toHaveLength(0)
        expect(container.querySelector('[class*="animate-spin"]')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: COPY.shakeAgain })).toBeEnabled()
    })

    it('records first candidates arriving with done exactly once for that search', () => {
        mockSession.state = 'searching'
        const { rerender } = renderView()
        triggerShake()
        expect(matchedEvents()).toEqual([])
        mockSession.state = 'done'
        mockSession.candidates = [ANA, BOB]
        rerender(<ShakeToPayView onPrev={onPrev} />)
        expect(matchedEvents()).toEqual([['shake_to_pay_matched', { count: 2 }]])
        rerender(<ShakeToPayView onPrev={onPrev} />)
        mockSession.candidates = [ANA]
        rerender(<ShakeToPayView onPrev={onPrev} />)
        expect(matchedEvents()).toHaveLength(1)
    })

    it('does not double count candidates already matched while searching when done arrives', () => {
        mockSession.state = 'searching'
        const { rerender } = renderView()
        triggerShake()
        mockSession.candidates = [ANA]
        rerender(<ShakeToPayView onPrev={onPrev} />)
        expect(matchedEvents()).toEqual([['shake_to_pay_matched', { count: 1 }]])
        mockSession.state = 'done'
        mockSession.candidates = [ANA, BOB]
        rerender(<ShakeToPayView onPrev={onPrev} />)
        expect(matchedEvents()).toHaveLength(1)
    })

    it('a fresh manual search can record its own first done candidates', () => {
        const { rerender } = renderView()
        triggerShake()
        mockSession.state = 'done'
        mockSession.candidates = [ANA]
        rerender(<ShakeToPayView onPrev={onPrev} />)
        expect(matchedEvents()).toEqual([['shake_to_pay_matched', { count: 1 }]])
        fireEvent.click(retryButton())
        mockSession.state = 'searching'
        mockSession.candidates = []
        rerender(<ShakeToPayView onPrev={onPrev} />)
        mockSession.state = 'done'
        mockSession.candidates = [BOB, CARL]
        rerender(<ShakeToPayView onPrev={onPrev} />)
        expect(matchedEvents()).toEqual([
            ['shake_to_pay_matched', { count: 1 }],
            ['shake_to_pay_matched', { count: 2 }],
        ])
    })
})

describe('ShakeToPayView: the instant-camera stage', () => {
    it.each(SESSION_STATES)('shows the undeveloped "Nobody yet" print only when nobody was found (%s)', (state) => {
        mockSession.state = state
        mockSession.retryAfterSeconds = state === 'rate-limited' ? 10 : null
        renderView()

        const expected = state === 'no-match' || state === 'expired'
        expect(!!screen.queryByText('Nobody yet')).toBe(expected)
    })

    it('never shows the blank print next to real people', () => {
        mockSession.state = 'done'
        mockSession.candidates = [ANA]
        renderView()

        expect(screen.queryByText('Nobody yet')).not.toBeInTheDocument()
    })

    it.each([
        [[ANA], '1 person nearby'],
        [[ANA, BOB, CARL], '3 people nearby'],
    ])('counts the people found in the heading once the search is done (%#)', (people, heading) => {
        mockSession.state = 'done'
        mockSession.candidates = people
        renderView()

        expect(byText(heading)).toBeInTheDocument()
        expect(payButtons()).toHaveLength(people.length)
    })

    it('"Not here? Shake again" starts a fresh tap search without leaving', () => {
        mockSession.state = 'done'
        mockSession.candidates = [ANA]
        renderView()

        fireEvent.click(screen.getByRole('button', { name: COPY.notHere }))

        expect(mockSession.shake).toHaveBeenCalledTimes(1)
        expect(shakeEvents().at(-1)).toEqual(['shake_to_pay_shake', { method: 'tap', has_location: false }])
        expect(onPrev).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('labels the camera for screen readers', () => {
        renderView()

        expect(screen.getByRole('img', { name: 'Instant camera looking for people nearby' })).toBeInTheDocument()
    })
})

describe('ShakeToPayView: StrictMode with the real session hook', () => {
    it.each(['pending', 'granted'] as const)(
        'sends exactly one create and retains its live session when location is %s',
        async (status) => {
            mockUseRealSession = true
            mockLocation = { status, location: status === 'granted' ? LOCATION : null }
            const { unmount } = renderWithIntl(
                <StrictMode>
                    <ShakeToPayView onPrev={onPrev} />
                </StrictMode>
            )
            await advanceEntry(status === 'pending' ? 2000 : 0)
            expect(mockEntryCreate.mock.calls).toEqual([[mockLocation.location]])
            expect(mockEntryCancel).not.toHaveBeenCalled()
            expect(shakeEvents()).toHaveLength(1)
            expect(byText(COPY.searching)).toBeInTheDocument()
            await advanceEntry(1500)
            expect(mockEntryGet.mock.calls).toEqual([['entry-session']])
            expect(mockEntryCreate).toHaveBeenCalledTimes(1)
            unmount()
            expect(mockEntryCancel.mock.calls).toEqual([['entry-session']])
        }
    )
})
