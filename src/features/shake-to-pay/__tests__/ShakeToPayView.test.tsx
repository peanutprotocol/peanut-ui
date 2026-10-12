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

let mockSession: {
    state: ShakeSearchState
    candidates: ShakeCandidate[]
    retryAfterSeconds: number | null
    shake: jest.Mock
    stop: jest.Mock
}
jest.mock('../useShakeSession', () => ({ useShakeSession: () => mockSession }))

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
const SESSION_STATES: ShakeSearchState[] = ['idle', 'searching', 'expired', 'error', 'rate-limited']

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
    start: 'Start shaking',
    motionDenied: 'Motion access is off. Tap the button instead.',
    searching: 'Looking nearby…',
    empty: 'No one yet. Ask them to shake too.',
    expired: 'Search ended. Shake again to look for people.',
    error: "Couldn't reach Peanut. Check your connection and try again.",
    locationHint: 'Turn on location to find people near you more easily.',
    listTitle: 'People nearby',
    confirmRecipient: 'Check the @username before you pay.',
}
const rateLimitedCopy = (seconds: number) => `Too many shakes. Try again in ${seconds}s.`

const byText = (text: string) => screen.queryByText(copy(text))
const tapButton = () => screen.getByRole('button', { name: COPY.tap })
const payButton = (name: string) => screen.getByRole('button', { name: `Pay ${name}` })
const payButtons = () => screen.queryAllByRole('button', { name: /^Pay / })

/** Which of the state messages are on screen, so a state can be checked to show exactly its own. */
function shownStateMessages(): string[] {
    const shown: string[] = []
    if (byText(COPY.searching)) shown.push('searching')
    if (byText(COPY.empty)) shown.push('empty')
    if (byText(COPY.expired)) shown.push('expired')
    if (byText(COPY.error)) shown.push('error')
    if (screen.queryByText(/^Too many shakes/)) shown.push('rate-limited')
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
    Reflect.deleteProperty(window, 'Capacitor')
})

// ---------------------------------------------------------------------------

describe('ShakeToPayView: header and instruction', () => {
    it('shows the title and the instruction', () => {
        renderView()

        expect(screen.getAllByText(COPY.title).length).toBeGreaterThanOrEqual(1)
        expect(byText(COPY.instruction)).toBeInTheDocument()
    })

    it.each(SESSION_STATES)('keeps the title in the %s state', (state) => {
        mockSession.state = state
        mockSession.retryAfterSeconds = state === 'rate-limited' ? 10 : null
        renderView()

        expect(screen.getAllByText(COPY.title).length).toBeGreaterThanOrEqual(1)
    })

    it.each(MOTION_STATUSES)('does not start a search by itself (motion %s)', (status) => {
        mockMotion.status = status
        renderView()

        expect(mockSession.shake).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })
})

describe('ShakeToPayView: the tap fallback', () => {
    const matrix = MOTION_STATUSES.flatMap((motion) => SESSION_STATES.map((state) => [motion, state] as const))

    it.each(matrix)('"Tap to find people" is always there (motion %s, search %s)', (motion, state) => {
        mockMotion.status = motion
        mockSession.state = state
        mockSession.retryAfterSeconds = state === 'rate-limited' ? 10 : null
        renderView()

        expect(tapButton()).toBeInTheDocument()
    })

    it('starts a search with the current location', () => {
        mockLocation = { location: LOCATION, status: 'granted' }
        renderView()

        fireEvent.click(tapButton())

        expect(mockSession.shake).toHaveBeenCalledTimes(1)
        expect(mockSession.shake).toHaveBeenCalledWith(LOCATION)
    })

    it.each<LocationStatus>(['pending', 'denied', 'unavailable'])(
        'starts a search with null when there is no location (location %s)',
        (status) => {
            mockLocation = { location: null, status }
            renderView()

            fireEvent.click(tapButton())

            expect(mockSession.shake).toHaveBeenCalledTimes(1)
            expect(mockSession.shake).toHaveBeenCalledWith(null)
        }
    )

    it('uses the location as it is now, not as it was at first render', () => {
        const { rerender } = renderView()
        mockLocation = { location: LOCATION, status: 'granted' }
        rerender(<ShakeToPayView onPrev={onPrev} />)

        fireEvent.click(tapButton())

        expect(mockSession.shake).toHaveBeenCalledWith(LOCATION)
    })

    it('works with no accelerometer at all', () => {
        mockMotion.status = 'unsupported'
        renderView()

        fireEvent.click(tapButton())

        expect(mockSession.shake).toHaveBeenCalledTimes(1)
    })

    it('can be tapped again while already searching', () => {
        mockSession.state = 'searching'
        renderView()

        fireEvent.click(tapButton())
        fireEvent.click(tapButton())

        expect(mockSession.shake).toHaveBeenCalledTimes(2)
    })

    it('does not leave the screen', () => {
        renderView()

        fireEvent.click(tapButton())

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
        renderView()

        expect(byText(COPY.motionDenied)).toBeInTheDocument()
        expect(tapButton()).toBeInTheDocument()
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

    it('starts a search with the current location, like the tap', () => {
        mockLocation = { location: LOCATION, status: 'granted' }
        renderView()

        triggerShake()

        expect(mockSession.shake).toHaveBeenCalledTimes(1)
        expect(mockSession.shake).toHaveBeenCalledWith(LOCATION)
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
    it('idle: no status message and no list', () => {
        renderView()

        expect(shownStateMessages()).toEqual([])
        expect(byText(COPY.listTitle)).not.toBeInTheDocument()
        expect(payButtons()).toHaveLength(0)
    })

    it('searching with nobody yet: "Looking nearby…" and "No one yet. Ask them to shake too."', () => {
        mockSession.state = 'searching'
        renderView()

        expect(shownStateMessages()).toEqual(['searching', 'empty'])
        expect(payButtons()).toHaveLength(0)
    })

    it('searching with people: "Looking nearby…", the list title, and no "No one yet"', () => {
        mockSession.state = 'searching'
        mockSession.candidates = [ANA, BOB]
        renderView()

        expect(shownStateMessages()).toEqual(['searching'])
        expect(byText(COPY.listTitle)).toBeInTheDocument()
        expect(payButtons()).toHaveLength(2)
    })

    it('expired: "Search ended. Shake again to look for people."', () => {
        mockSession.state = 'expired'
        renderView()

        expect(shownStateMessages()).toEqual(['expired'])
        expect(payButtons()).toHaveLength(0)
        expect(byText(COPY.listTitle)).not.toBeInTheDocument()
    })

    it('error: "Couldn\'t reach Peanut. Check your connection and try again."', () => {
        mockSession.state = 'error'
        renderView()

        expect(shownStateMessages()).toEqual(['error'])
        expect(payButtons()).toHaveLength(0)
        expect(byText(COPY.listTitle)).not.toBeInTheDocument()
    })

    it.each([1, 12, 45, 600])('rate-limited: "Too many shakes. Try again in %is."', (seconds) => {
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
        expect(shownStateMessages()).toEqual(['searching'])

        mockSession.state = 'expired'
        mockSession.candidates = []
        rerender(<ShakeToPayView onPrev={onPrev} />)
        expect(shownStateMessages()).toEqual(['expired'])
        expect(payButtons()).toHaveLength(0)

        mockSession.state = 'searching'
        mockSession.candidates = [BOB]
        rerender(<ShakeToPayView onPrev={onPrev} />)
        expect(shownStateMessages()).toEqual(['searching'])
        expect(payButtons()).toHaveLength(1)
    })
})

describe('ShakeToPayView: location hint', () => {
    it.each<LocationStatus>(['denied', 'unavailable'])('shows the hint when location is %s', (status) => {
        mockLocation = { location: null, status }
        renderView()

        expect(byText(COPY.locationHint)).toBeInTheDocument()
    })

    it.each<LocationStatus>(['pending', 'granted'])('does not show the hint when location is %s', (status) => {
        mockLocation = { location: status === 'granted' ? LOCATION : null, status }
        renderView()

        expect(byText(COPY.locationHint)).not.toBeInTheDocument()
    })

    it.each<ShakeSearchState>(['searching', 'expired', 'error'])('keeps showing the hint while %s', (state) => {
        mockLocation = { location: null, status: 'denied' }
        mockSession.state = state
        renderView()

        expect(byText(COPY.locationHint)).toBeInTheDocument()
    })

    it('does not block searching: the tap still works without a location', () => {
        mockLocation = { location: null, status: 'denied' }
        renderView()

        fireEvent.click(tapButton())

        expect(mockSession.shake).toHaveBeenCalledWith(null)
    })

    it('never prints the coordinates', () => {
        mockLocation = { location: LOCATION, status: 'granted' }
        mockSession.state = 'searching'
        mockSession.candidates = [ANA]
        const { container } = renderView()

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
        fireEvent.click(tapButton())
        triggerShake()
        fireEvent.click(payButton('Zed Qwertyson'))
        fireEvent.click(screen.getByRole('button', { name: 'Back' }))

        const sent = JSON.stringify(mockCapture.mock.calls)
        for (const secret of ['52.37', '4.895', 'zq_unique_user', 'Zed Qwertyson', 'latitude', 'longitude']) {
            expect(sent).not.toContain(secret)
        }
    })

    it('does not put the coordinates anywhere in the page', () => {
        mockLocation = { location: LOCATION, status: 'granted' }
        mockSession.state = 'searching'
        mockSession.candidates = [PRIVATE]
        const { container } = renderView()

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
