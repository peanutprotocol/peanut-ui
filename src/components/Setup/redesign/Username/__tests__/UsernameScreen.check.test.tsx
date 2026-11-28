/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/*
 * 02 Username: availability answers, the taken chips and the return to 02 (C.md § 3.1 states 7–9, § 4.1, § 4.3,
 * § 4.4, checks C-16..C-20, C-26).
 */
import { act, fireEvent, screen, within } from '@testing-library/react'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { controlsOf, eventsOf, loose, setupState } from '@/components/Setup/redesign/Landing/__tests__/redesign-harness'
import {
    alternatives,
    availabilityStub,
    card,
    checkedNames,
    checksFor,
    deferred,
    field,
    helpText,
    named,
    expectPrimaryLabel,
    primary,
    renderUsername,
    tagText,
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
const validated = () => eventsOf(capture(), ANALYTICS_EVENTS.SIGNUP_USERNAME_VALIDATED)
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
const mount = async (options?: Parameters<typeof renderUsername>[0]) => {
    const view = renderUsername(options)
    await advance(400)
    return view
}
const chipNames = () =>
    within(alternatives() as HTMLElement)
        .getAllByRole('button')
        .map((chip) => loose(chip.textContent ?? ''))
/** The C-16 stub: tiger is taken; its alternatives answer tiger3 free, tinytiger taken, boldtiger free. */
const TIGER = { tiger: 200, tiger3: 404, tinytiger: 200, boldtiger: 404 } as const

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

describe('02 Username — availability answers (C.md § 4.1)', () => {
    it('C-16 check 200 for "tiger": taken line, red field, chips only for names whose own check answered 404', async () => {
        mockApiFetch.mockImplementation(availabilityStub(TIGER, 404))
        await mount()
        await type('tiger')
        await advance(800)
        await advance(800)

        expect(setupState()).toBe('taken')
        expect(helpText()).toContain(loose(U('taken', { name: 'tiger' })))
        expect(field()).toHaveAttribute('aria-invalid', 'true')
        expect(primary()).toBeDisabled()
        expect(validated()).toContainEqual(
            expect.objectContaining({ is_valid: false, error_type: 'taken', source: 'typed' })
        )
        expect(controlsOf(capture())).toContain('username:error:taken')

        expect(alternatives()).not.toBeNull()
        expect(alternatives()).toHaveTextContent(loose(U('takenLead')))
        expect(chipNames()).toEqual(['@tiger3', '@boldtiger'])
        // each chip was checked before it showed; at most 6 alternative checks
        expect(checksFor(mockApiFetch, 'tiger3')).toBe(1)
        expect(checksFor(mockApiFetch, 'tinytiger')).toBe(1)
        expect(checksFor(mockApiFetch, 'boldtiger')).toBe(1)
        const alternativeChecks = checkedNames(mockApiFetch).filter(
            (name) => name !== 'tiger' && name.includes('tiger')
        )
        expect(alternativeChecks.length).toBeLessThanOrEqual(6)
    })

    it('C-17 no alternative answers 404: no chip row and no "Available:" lead', async () => {
        mockApiFetch.mockImplementation(async (path: string) =>
            availabilityStub({}, path.includes('tiger') ? 200 : 404)(path)
        )
        await mount()
        await type('tiger')
        await advance(800)
        await advance(800)
        expect(setupState()).toBe('taken')
        expect(alternatives()).toBeNull()
        expect(document.body.textContent ?? '').not.toContain(U('takenLead'))
    })

    it('C-18 a chip tap fills the field and is available without a new request', async () => {
        mockApiFetch.mockImplementation(availabilityStub(TIGER, 404))
        await mount()
        await type('tiger')
        await advance(1600)
        const before = checksFor(mockApiFetch, 'tiger3')

        await act(async () => {
            fireEvent.click(within(alternatives() as HTMLElement).getByRole('button', { name: named('@tiger3') }))
        })
        await advance(800)
        expect(field()).toHaveValue('tiger3')
        expect(setupState()).toBe('available')
        expect(checksFor(mockApiFetch, 'tiger3')).toBe(before)
        expect(primary()).toBeEnabled()
        await expectPrimaryLabel(loose(U('ctaNamed', { name: 'tiger3' })))
        expect(controlsOf(capture())).toContain('username_alt:select:1')
        expect(validated()).toContainEqual(expect.objectContaining({ is_valid: true, source: 'chip' }))
    })

    it('C-19 check 404: "Available" with the check dot and "Use @mellowfox"', async () => {
        await mount()
        await type('mellowfox')
        await advance(800)
        expect(setupState()).toBe('available')
        expect(helpText()).toContain(loose(U('available')))
        expect(primary()).toBeEnabled()
        await expectPrimaryLabel(loose(U('ctaNamed', { name: 'mellowfox' })))
        expect(card()).toHaveTextContent('@mellowfox')
        expect(validated()).toEqual([expect.objectContaining({ is_valid: true, source: 'typed' })])
    })

    it('TASK-25341 a late 404 for an older name never marks the name now in the field available', async () => {
        const late = deferred<number>()
        mockApiFetch.mockImplementation(availabilityStub({ mellowfox: late.promise, tiger: 200 }, 404))
        await mount()
        await type('mellowfox')
        await advance(800)
        await type('tiger')
        await advance(800)
        expect(setupState()).toBe('taken')

        await act(async () => late.resolve(404))
        await advance(100)
        expect((field() as HTMLInputElement).value).toBe('tiger')
        expect(setupState()).toBe('taken')
        expect(helpText()).toContain(loose(U('taken', { name: 'tiger' })))
        expect(helpText()).not.toContain(loose(U('available')))
        expect(primary()).toBeDisabled()
    })

    it('C-20 check 400 shows the reserved line and reports error_type invalid', async () => {
        mockApiFetch.mockImplementation(availabilityStub({ oddname: 400 }, 404))
        await mount()
        await type('oddname')
        await advance(800)
        expect(setupState()).toBe('reserved')
        expect(helpText()).toContain(loose(U('reserved')))
        expect(primary()).toBeDisabled()
        expect(validated()).toContainEqual(expect.objectContaining({ is_valid: false, error_type: 'invalid' }))
    })

    it('C-20 check 503 shows the check-failed line with the support link, unexpected_status and a Sentry message', async () => {
        mockApiFetch.mockImplementation(availabilityStub({ mellowfox: 503 }, 404))
        await mount()
        await type('mellowfox')
        await advance(800)
        expect(setupState()).toBe('check-failed')
        expect(helpText()).toBe(loose(U('checkFailed')))
        expect(primary()).toBeDisabled()
        expect(controlsOf(capture())).toContain('username:error:unexpected_status')
        expect(Sentry.captureMessage).toHaveBeenCalled()

        const link = screen.getByRole('link', { name: named(tagText('setupRedesign.username.checkFailed', 'link')) })
        expect(link).toHaveAttribute('href', 'https://peanut.me/support')
        fireEvent.click(link)
        expect(controlsOf(capture())).toContain('username_support:tap')
    })

    it('C-20 a network throw shows the check-failed line and reports network', async () => {
        mockApiFetch.mockImplementation(availabilityStub({ mellowfox: new TypeError('Failed to fetch') }, 404))
        await mount()
        await type('mellowfox')
        await advance(800)
        expect(setupState()).toBe('check-failed')
        expect(helpText()).toBe(loose(U('checkFailed')))
        expect(controlsOf(capture())).toContain('username:error:network')
    })
})

describe('02 Username — return to 02 with a name (C.md § 4.4)', () => {
    it('C-26 a context name is shown and checked at once, with no suggestion; 404 makes it available', async () => {
        renderUsername({ username: 'lunamate' })
        await advance(50)
        expect(field()).toHaveValue('lunamate')
        expect(card()).toHaveTextContent('@lunamate')
        expect(checksFor(mockApiFetch, 'lunamate')).toBe(1)
        await advance(1000)
        expect(checkedNames(mockApiFetch)).toEqual(['lunamate'])
        expect(setupState()).toBe('available')
        expect(primary()).toBeEnabled()
        expect(validated()).toEqual([expect.objectContaining({ is_valid: true, source: 'return' })])
    })

    it('C-26 a returning name that answers 200 shows taken with chips and focuses the field, caret at the end', async () => {
        mockApiFetch.mockImplementation(availabilityStub({ lunamate: 200 }, 404))
        renderUsername({ username: 'lunamate' })
        await advance(1000)
        expect(setupState()).toBe('taken')
        expect(alternatives()).not.toBeNull()
        const input = field() as HTMLInputElement
        expect(document.activeElement).toBe(input)
        expect(input.selectionStart).toBe('lunamate'.length)
        expect(input.selectionEnd).toBe('lunamate'.length)
        expect(validated()).toContainEqual(
            expect.objectContaining({ is_valid: false, error_type: 'taken', source: 'return' })
        )
    })
})
