/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/*
 * 02 Username: typed values, the rule order, the debounce, clear, banned copy and es-AR (C.md § 3.1 states 4–6, 10,
 * § 4.1, checks C-11..C-15, C-21, C-27, C-29, C-30). Fake timers drive dev's 750 ms debounce.
 */
import { act, fireEvent, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import {
    BANNED_COPY,
    controlsOf,
    eventsOf,
    loose,
    msg,
    setupState,
} from '@/components/Setup/redesign/Landing/__tests__/redesign-harness'
import {
    availabilityStub,
    card,
    checksFor,
    clearButton,
    counterText,
    deferred,
    field,
    flowState,
    help,
    helpText,
    expectPrimaryLabel,
    primary,
    renderUsername,
    usernameCopy as U,
} from './username-harness'

const mockApiFetch = jest.fn()
const mockReserve = jest.fn()
const mockHandleNext = jest.fn(async () => {})
const mockSetScreenId = jest.fn()

jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
// The first suggestion starts at a random index. Unpinned, it is sometimes "mellowfox" (index 16, 116) or a chip
// name such as "boldtiger" (69, 129): typing the name already in the field fires no change, and a counted check
// runs twice. 77 suggests "cosmicmaple" (en) and "gatolibre" (es), which no test types or counts.
jest.mock('@/features/setup/username-suggestions', () => ({
    ...jest.requireActual('@/features/setup/username-suggestions'),
    randomSuggestionStart: () => 77,
}))
jest.mock('@/features/setup/username-reservation', () => ({
    ...jest.requireActual('@/features/setup/username-reservation'),
    reserveUsername: (name: string) => mockReserve(name),
}))
jest.mock('@/hooks/useSetupFlow', () => ({
    ...jest.requireActual('@/hooks/useSetupFlow'),
    useSetupFlow: () => ({ isLoading: false, handleNext: mockHandleNext, setScreenId: mockSetScreenId }),
}))
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: () => false,
    isNativeBridge: () => false,
}))
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))
jest.mock('@/utils/sentry-lazy', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), onFeatureFlags: jest.fn(() => () => {}), isFeatureEnabled: jest.fn(() => false) },
}))

const capture = () => posthog.capture as jest.Mock
const invalidTypes = () =>
    eventsOf(capture(), ANALYTICS_EVENTS.SIGNUP_USERNAME_INVALID).map((properties) => properties?.error_type)

const advance = async (ms: number) => {
    await act(async () => {
        jest.advanceTimersByTime(ms)
        await Promise.resolve()
    })
    await act(async () => {
        await Promise.resolve()
    })
}
const type = async (value: string) => {
    await act(async () => {
        fireEvent.change(field(), { target: { value } })
    })
}
/** Mount and let the first suggestion settle, so typed checks are the only new requests. */
const mount = async (options?: Parameters<typeof renderUsername>[0]) => {
    const view = renderUsername(options)
    await advance(400)
    return view
}
const isRed = () => field().getAttribute('aria-invalid') === 'true'

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockReserve.mockResolvedValue('reserved')
    mockApiFetch.mockImplementation(availabilityStub({}, 404))
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

describe('02 Username — typed values (C.md § 3.1, § 4.1)', () => {
    it('C-11 "MellowFox" is lowercased into the field and the context, and checked once, only after 750 ms', async () => {
        await mount()
        await type('MellowFox')
        expect(field()).toHaveValue('mellowfox')
        expect(flowState().username).toBe('mellowfox')
        expect(setupState()).toBe('typing')
        expect(helpText()).toContain(loose(U('rule')))
        expect(counterText()).toBe('9/12')

        await advance(749)
        expect(checksFor(mockApiFetch, 'mellowfox')).toBe(0)
        await advance(1)
        await advance(0)
        expect(checksFor(mockApiFetch, 'mellowfox')).toBe(1)
        await advance(2000)
        expect(checksFor(mockApiFetch, 'mellowfox')).toBe(1)
    })

    it('C-12 "abc" shows the grey rule line, never an alert, sends no request and reports too_short once after 750 ms', async () => {
        await mount()
        await type('abc')
        expect(helpText()).toContain(loose(U('rule')))
        expect(help().querySelector('[role="alert"]')).toBeNull()
        expect(help()).not.toHaveAttribute('role', 'alert')
        expect(isRed()).toBe(false)
        expect(primary()).toBeDisabled()
        expect(invalidTypes()).toEqual([])

        await advance(750)
        await advance(2000)
        expect(checksFor(mockApiFetch, 'abc')).toBe(0)
        expect(invalidTypes()).toEqual(['too_short'])
        expect(controlsOf(capture()).filter((control) => control === 'username:error:too_short')).toHaveLength(1)
        expect(helpText()).toContain(loose(U('rule')))
        expect(primary()).toBeDisabled()
    })

    // Ported from dev's Signup.test "reports the same validation category again after … editing" (C § 6.1).
    it('C-12 an edit clears the reported too_short, so the next settled short value reports it again', async () => {
        await mount()
        await type('ab')
        await advance(750)
        await type('abc')
        await advance(750)
        expect(controlsOf(capture()).filter((control) => control === 'username:error:too_short')).toHaveLength(2)
        expect(invalidTypes()).toEqual(['too_short', 'too_short'])
    })

    it.each([
        ['9lucky', 'invalidStart'],
        ['lu ky', 'invalidChars'],
        ['lúcky', 'invalidChars'],
        ['ab.cd', 'invalidChars'],
    ])('C-13 "%s" shows %s, a red field, no request, error_type format', async (value, key) => {
        await mount()
        await type(value)
        await advance(800)
        expect(helpText()).toContain(loose(U(key)))
        expect(isRed()).toBe(true)
        expect(setupState()).toBe('invalid')
        expect(primary()).toBeDisabled()
        expect(checksFor(mockApiFetch, value.toLowerCase())).toBe(0)
        expect(invalidTypes()).toContain('format')
        expect(controlsOf(capture())).toContain('username:error:format')
    })

    it('C-14 too long: "luckyotterclub" asks to remove 2 letters, 14/12, letters 13–14 marked; 13 letters ask for 1', async () => {
        await mount()
        await type('luckyotterclub')
        await advance(800)
        expect(setupState()).toBe('too-long')
        expect(helpText()).toContain(loose(U('tooLong', { n: 2 })))
        expect(counterText()).toBe('14/12')
        expect(screen.getByTestId('setup-redesign-username-overflow')).toHaveTextContent(/^ub$/)
        expect(primary()).toBeDisabled()
        expect(invalidTypes()).toContain('too_long')

        await type('luckyotterclu')
        await advance(800)
        expect(helpText()).toContain(loose(U('tooLong', { n: 1 })))
        expect(counterText()).toBe('13/12')
        expect(screen.getByTestId('setup-redesign-username-overflow')).toHaveTextContent(/^u$/)
        expect(checksFor(mockApiFetch, 'luckyotterclub') + checksFor(mockApiFetch, 'luckyotterclu')).toBe(0)
    })

    it.each(['  mellowfox  ', 'mellowfox\n', '@mellowfox', '@MellowFox '])(
        'R2-11 a pasted "%s" is checked as "mellowfox"',
        async (pasted) => {
            await mount()
            await type(pasted)
            expect(field()).toHaveValue('mellowfox')
            await advance(800)
            expect(checksFor(mockApiFetch, 'mellowfox')).toBe(1)
            expect(setupState()).toBe('available')
        }
    )

    it('R2-09 an invalid name past 12 letters is not marked as too long; the mirror shows it plain', async () => {
        await mount()
        await type('https://peanut.me/x')
        await advance(800)
        expect(setupState()).toBe('invalid')
        expect(screen.queryByTestId('setup-redesign-username-overflow')).toBeNull()
        expect(screen.getByTestId('username-mirror')).toHaveTextContent('https://peanut.me/x')
    })

    it('R2-09 the card shows the typed name and ends in an ellipsis past its smallest size, never cut bare', async () => {
        await mount()
        await type('abcdefghijklmnopqrst')
        await advance(800)
        const lines = card().querySelectorAll('span.block')
        expect(lines[0]).toHaveTextContent('@abcdefghijklmnopqrst')
        expect(lines[1]).toHaveTextContent('peanut.me/abcdefghijklmnopqrst')
        for (const line of lines) expect(line).toHaveClass('overflow-hidden', 'text-ellipsis', 'whitespace-nowrap')
    })

    it.each(['teampeanut', 'official'])(
        'C-15 "%s" is reserved: the reserved line, no request, username:error refused',
        async (value) => {
            await mount()
            await type(value)
            await advance(800)
            expect(helpText()).toContain(loose(U('reserved')))
            expect(isRed()).toBe(true)
            expect(primary()).toBeDisabled()
            expect(checksFor(mockApiFetch, value)).toBe(0)
            expect(controlsOf(capture())).toContain('username:error:refused')
        }
    )

    it('C-15 a value equal to refusedUsername is reserved too, and an edit clears refusedUsername', async () => {
        await mount({ username: 'kimchi', refusedUsername: 'kimchi' })
        expect(field()).toHaveValue('kimchi')
        expect(helpText()).toContain(loose(U('reserved')))
        expect(primary()).toBeDisabled()
        expect(flowState().refusedUsername).toBe('kimchi')

        await type('kimchis')
        expect(flowState().refusedUsername).toBeNull()
        await advance(800)
        expect(helpText()).not.toContain(loose(U('reserved')))
    })

    it('C-21 a check answer for an older value changes nothing; only the current value’s answer shows', async () => {
        const older = deferred<number>()
        mockApiFetch.mockImplementation(availabilityStub({ mellowfo: older.promise, mellowfox: 404 }))
        await mount()
        await type('mellowfo')
        await advance(800)
        expect(checksFor(mockApiFetch, 'mellowfo')).toBe(1)

        await type('mellowfox')
        await advance(800)
        expect(helpText()).toContain(loose(U('available')))
        await expectPrimaryLabel(loose(U('ctaNamed', { name: 'mellowfox' })))

        await act(async () => older.resolve(200))
        await advance(10)
        expect(field()).toHaveValue('mellowfox')
        expect(helpText()).toContain(loose(U('available')))
        expect(helpText()).not.toContain(loose(U('taken', { name: 'mellowfo' })))
        expect(primary()).toBeEnabled()
        const results = eventsOf(capture(), ANALYTICS_EVENTS.SIGNUP_USERNAME_VALIDATED)
        expect(results).toEqual([expect.objectContaining({ is_valid: true, source: 'typed' })])
    })

    it('C-27 clear × empties and focuses the field, shows the rule, disables the button and reports the tap', async () => {
        await mount()
        // while typing, before the check: the field row shows clear × (C.md § 2 field row)
        await type('mellowf')
        await advance(100)

        await act(async () => {
            fireEvent.click(clearButton())
        })
        expect(field()).toHaveValue('')
        expect(document.activeElement).toBe(field())
        expect(helpText()).toContain(loose(U('rule')))
        expect(primary()).toBeDisabled()
        expect(controlsOf(capture())).toContain('username_clear:tap')
    })
})

describe('02 Username — copy rules (C.md § 5)', () => {
    it.each(['en', 'es-AR'] as const)(
        'C-29 (%s) no removed hint, no banned words, no terms line on 02',
        async (locale) => {
            mockApiFetch.mockImplementation(availabilityStub({ tiger: 200, tigre: 200 }))
            await mount({ locale })
            const check = () => {
                const text = loose(document.body.textContent ?? '')
                expect(text).not.toContain('Type your own or roll the die.')
                expect(text).not.toContain('Escribí el tuyo o tirá el dado.')
                for (const banned of BANNED_COPY) expect(text).not.toMatch(banned)
                expect(text).not.toContain(loose(msg('setupRedesign.passkey.terms', {}, locale)))
                expect(text).not.toMatch(/T&C|By creating an account/)
                expect(screen.queryByRole('link', { name: /terms|términos|privacy|privacidad/i })).toBeNull()
            }
            check()
            await type(locale === 'en' ? 'tiger' : 'tigre')
            await advance(800)
            check()
            await type('9lucky')
            await advance(800)
            check()
        }
    )

    it('C-30 es-AR: title with a no-break space, "Usar @lunamate", "@tigre ya está en uso."', async () => {
        mockApiFetch.mockImplementation(availabilityStub({ lunamate: 404, tigre: 200 }))
        await mount({ locale: 'es-AR' })
        const title = screen.getByRole('heading', { level: 1 }).textContent ?? ''
        expect(title).toBe(msg('setupRedesign.username.title', {}, 'es-AR'))
        expect(title).toContain('nombre de usuario.')

        await type('lunamate')
        await advance(800)
        await expectPrimaryLabel(loose(U('ctaNamed', { name: 'lunamate' }, 'es-AR')))

        await type('tigre')
        await advance(800)
        expect(helpText()).toContain(loose(U('taken', { name: 'tigre' }, 'es-AR')))
    })
})
