/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/*
 * 02 Username: the checked first suggestion, the die and the default state (C.md § 3.1 states 1–3, § 4.3,
 * checks C-05..C-10, C-31). Suggestions are random per mount; these tests never assume which name comes first.
 * They answer the availability check per name and read the name the screen asked about.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { controlsOf, eventsOf, loose, setupState } from '@/components/Setup/redesign/Landing/__tests__/redesign-harness'
import {
    availabilityStub,
    card,
    checkedNames,
    deferred,
    die,
    field,
    helpText,
    expectPrimaryLabel,
    primary,
    renderUsername,
    setReducedMotion,
    usernameCopy as U,
    USERNAME_PATTERN,
} from './username-harness'

const mockApiFetch = jest.fn()
const mockReserve = jest.fn()
const mockHandleNext = jest.fn(async () => {})
const mockSetScreenId = jest.fn()

jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
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

const WAIT = { timeout: 3000 }
const capture = () => posthog.capture as jest.Mock
const validated = () => eventsOf(capture(), ANALYTICS_EVENTS.SIGNUP_USERNAME_VALIDATED)

/** Waits for the checked first suggestion to land in the field (state `default`). */
async function suggestionLanded() {
    await waitFor(() => expect((field() as HTMLInputElement).value).not.toBe(''), WAIT)
    const name = (field() as HTMLInputElement).value
    expect(name).toMatch(USERNAME_PATTERN)
    return name
}

beforeEach(() => {
    jest.clearAllMocks()
    setReducedMotion(false)
    mockReserve.mockResolvedValue('reserved')
    mockApiFetch.mockImplementation(availabilityStub({}, 404))
})
afterEach(() => setReducedMotion(false))

describe('02 Username — first suggestion and default (C.md § 3.1, § 4.3)', () => {
    it('C-05 the field stays empty with "Use this username" disabled until the first check answers 404, then shows that name', async () => {
        const held = deferred<number>()
        let first: string | null = null
        mockApiFetch.mockImplementation(async (path: string) => {
            const name = path.split('/').pop() as string
            first ??= name
            return availabilityStub({ [first]: held.promise }, 404)(path)
        })
        renderUsername()

        await waitFor(() => expect(first).not.toBeNull(), WAIT)
        expect((field() as HTMLInputElement).value).toBe('')
        expect(primary()).toBeDisabled()
        await expectPrimaryLabel(loose(U('cta')))

        await act(async () => held.resolve(404))
        await waitFor(() => expect((field() as HTMLInputElement).value).toBe(first), WAIT)
        expect(card()).toHaveTextContent(`@${first}`)
        expect(setupState()).toBe('default')
        expect(helpText()).toBe('')
        expect(primary()).toBeDisabled()
        expect(screen.getByTestId('setup-redesign-username')).toBeInTheDocument()
        // the first suggestion's silent check sends nothing (§ 6.1)
        expect(validated()).toEqual([])
    })

    it('C-06 when the first 5 candidates answer an error, no name and no error show, the die works, nothing is reported', async () => {
        mockApiFetch.mockImplementation(availabilityStub({}, 500))
        renderUsername()

        await waitFor(() => expect(checkedNames(mockApiFetch)).toHaveLength(5), WAIT)
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100))
        })
        expect(checkedNames(mockApiFetch)).toHaveLength(5)
        expect((field() as HTMLInputElement).value).toBe('')
        expect(field()).not.toHaveAttribute('placeholder', expect.stringMatching(USERNAME_PATTERN))
        expect(helpText()).toBe('')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(die()).toBeEnabled()
        expect(primary()).toBeDisabled()
        expect(validated()).toEqual([])
    })

    it('C-07 a die roll shows rolling, then lands a checked name with "Available" and an enabled "Use @name"', async () => {
        renderUsername()
        const before = await suggestionLanded()
        const held = deferred<number>()
        const asked: string[] = []
        mockApiFetch.mockImplementation(async (path: string) => {
            const name = path.split('/').pop() as string
            asked.push(name)
            return availabilityStub({ [name]: held.promise })(path)
        })

        fireEvent.click(die())
        await waitFor(() => expect(setupState()).toBe('rolling'), WAIT)
        expect(helpText()).toContain(loose(U('rolling')))
        expect(die()).toBeDisabled()
        expect(primary()).toBeDisabled()

        await act(async () => held.resolve(404))
        await waitFor(() => expect(setupState()).toBe('rolled'), WAIT)
        const rolled = (field() as HTMLInputElement).value
        expect(rolled).toMatch(USERNAME_PATTERN)
        expect(rolled).not.toBe(before)
        expect(asked).toContain(rolled)
        expect(helpText()).toContain(loose(U('available')))
        expect(primary()).toBeEnabled()
        await expectPrimaryLabel(loose(U('ctaNamed', { name: rolled })))
        expect(card()).toHaveTextContent(`@${rolled}`)

        const controls = controlsOf(capture())
        expect(controls).toContain('username_die:tap')
        expect(controls).not.toContain('username:change')
        expect(validated()).toEqual([expect.objectContaining({ is_valid: true, source: 'die' })])
    })

    it('C-08 a roll whose candidates all fail brings the previous name back without the check-failed line (TASK-25341)', async () => {
        renderUsername()
        const before = await suggestionLanded()
        mockApiFetch.mockImplementation(availabilityStub({}, 200))

        fireEvent.click(die())
        await waitFor(() => expect(setupState()).toBe('rolling'), WAIT)
        await waitFor(() => expect(setupState()).toBe('default'), WAIT)
        expect((field() as HTMLInputElement).value).toBe(before)
        expect(helpText()).not.toContain(loose(U('checkFailed')))
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(die()).toBeEnabled()
        expect(controlsOf(capture())).toContain('username_die:error:network')
        expect(validated()).toEqual([])
    })

    it('TASK-25341 a roll skips candidates that fail, abort or are taken, and lands the first free one with no error', async () => {
        renderUsername()
        await suggestionLanded()
        const asked: string[] = []
        mockApiFetch.mockImplementation(async (path: string) => {
            const name = path.split('/').pop() as string
            asked.push(name)
            const answer =
                [Object.assign(new Error('aborted'), { name: 'AbortError' }), 503, 200][asked.length - 1] ?? 404
            return availabilityStub({ [name]: answer })(path)
        })

        fireEvent.click(die())
        await waitFor(() => expect(setupState()).toBe('rolled'), WAIT)
        expect(asked).toHaveLength(4)
        expect((field() as HTMLInputElement).value).toBe(asked[3])
        expect(helpText()).toContain(loose(U('available')))
        expect(helpText()).not.toContain(loose(U('checkFailed')))
    })

    it('TASK-25341 a rolled name lost to another hold at claim rolls again instead of showing it taken', async () => {
        renderUsername()
        await suggestionLanded()
        fireEvent.click(die())
        await waitFor(() => expect(setupState()).toBe('rolled'), WAIT)
        const lost = (field() as HTMLInputElement).value
        mockReserve.mockResolvedValueOnce('taken')

        fireEvent.click(primary())
        await waitFor(() => expect(mockReserve).toHaveBeenCalledWith(lost), WAIT)
        await waitFor(() => expect((field() as HTMLInputElement).value).not.toBe(lost), WAIT)
        await waitFor(() => expect(setupState()).toBe('rolled'), WAIT)
        expect(helpText()).not.toContain(loose(U('taken', { name: lost })))
        expect(helpText()).toContain(loose(U('available')))
        expect(primary()).toBeEnabled()
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it('C-09 in default the button stays disabled although the suggestion was checked; a landed roll enables it', async () => {
        renderUsername()
        await suggestionLanded()
        expect(setupState()).toBe('default')
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 1000))
        })
        expect(primary()).toBeDisabled()
        fireEvent.click(primary())
        expect(mockReserve).not.toHaveBeenCalled()
        expect(mockHandleNext).not.toHaveBeenCalled()

        fireEvent.click(die())
        await waitFor(() => expect(setupState()).toBe('rolled'), WAIT)
        expect(primary()).toBeEnabled()
    })

    it('C-10 focus in default empties the field and shows the suggestion as placeholder with the rule; blur restores it', async () => {
        renderUsername()
        const suggestion = await suggestionLanded()

        act(() => {
            field().focus()
            fireEvent.focus(field())
        })
        await waitFor(() => expect((field() as HTMLInputElement).value).toBe(''), WAIT)
        expect(field()).toHaveAttribute('placeholder', suggestion)
        expect(helpText()).toContain(loose(U('rule')))
        expect(primary()).toBeDisabled()

        act(() => {
            field().blur()
            fireEvent.blur(field())
        })
        await waitFor(() => expect((field() as HTMLInputElement).value).toBe(suggestion), WAIT)
        expect(setupState()).toBe('default')
        expect(helpText()).toBe('')
    })
})

describe('02 Username — claim refused, no replacement (TASK-25341)', () => {
    it('a rolled name refused as taken at claim, with every replacement taken or failing, shows taken and stays unclaimable', async () => {
        renderUsername()
        await suggestionLanded()
        fireEvent.click(die())
        await waitFor(() => expect(setupState()).toBe('rolled'), WAIT)
        const lost = (field() as HTMLInputElement).value
        mockReserve.mockResolvedValueOnce('taken')
        let replacement = 0
        mockApiFetch.mockImplementation(async (path: string) => {
            const name = path.split('/').pop() as string
            // the re-roll's candidates all fail; the chips for the lost name may answer free
            if (name.startsWith(lost) || name.endsWith(lost)) return availabilityStub({}, 404)(path)
            replacement += 1
            return availabilityStub({}, replacement % 2 ? 200 : 503)(path)
        })

        fireEvent.click(primary())
        await waitFor(() => expect(mockReserve).toHaveBeenCalledWith(lost), WAIT)
        await waitFor(() => expect(setupState()).toBe('taken'), WAIT)
        expect(replacement).toBeGreaterThan(0)
        expect((field() as HTMLInputElement).value).toBe(lost)
        expect(helpText()).toContain(loose(U('taken', { name: lost })))
        expect(primary()).toBeDisabled()
        fireEvent.click(primary())
        expect(mockReserve).toHaveBeenCalledTimes(1)
        expect(mockHandleNext).not.toHaveBeenCalled()
    })
})

describe('02 Username — reduced motion (C.md § 2 Motion)', () => {
    it('C-31 under reduced motion a roll scrambles no letters and animates nothing; the new name shows after its check', async () => {
        setReducedMotion(true)
        const animate = jest.fn(() => ({ cancel: jest.fn(), finished: Promise.resolve(), onfinish: null }))
        const original = (Element.prototype as { animate?: unknown }).animate
        ;(Element.prototype as { animate?: unknown }).animate = animate
        try {
            renderUsername()
            const before = await suggestionLanded()
            const held = deferred<number>()
            mockApiFetch.mockImplementation(async (path: string) =>
                availabilityStub({ [path.split('/').pop() as string]: held.promise })(path)
            )
            animate.mockClear()

            fireEvent.click(die())
            await waitFor(() => expect(setupState()).toBe('rolling'), WAIT)
            // no letter scramble: while the check runs the field holds the old name (or nothing), never other letters
            const seen = new Set<string>()
            for (let tick = 0; tick < 5; tick++) {
                await act(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 60))
                })
                seen.add((field() as HTMLInputElement).value)
            }
            expect([...seen].filter((value) => value !== before && value !== '')).toEqual([])
            expect(die().getAttribute('style') ?? '').not.toMatch(/rotate/)
            expect(card().getAttribute('style') ?? '').not.toMatch(/rotate[XY]|scaleX\(-/)

            await act(async () => held.resolve(404))
            await waitFor(() => expect(setupState()).toBe('rolled'), WAIT)
            expect((field() as HTMLInputElement).value).not.toBe(before)
            expect(animate).not.toHaveBeenCalled()
        } finally {
            ;(Element.prototype as { animate?: unknown }).animate = original
        }
    })
})
