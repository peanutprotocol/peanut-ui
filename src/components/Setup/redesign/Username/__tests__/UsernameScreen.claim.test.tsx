/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/*
 * 02 Username: the button (Claim), the demo path and the privacy rule (C.md § 3.1 states 10–11, § 4.2, § 6.1,
 * checks C-22..C-25, C-28). Ported from Views/__tests__/Signup.test.tsx and Signup.reservation-errors.test.tsx.
 */
import { act, fireEvent, within } from '@testing-library/react'
import posthog from 'posthog-js'
import { USER } from '@/constants/query.consts'
import { DEMO_USER } from '@/constants/demo-data'
import { disableDemoMode, isDemoMode } from '@/utils/demo'
import { controlsOf, loose, setupState } from '@/components/Setup/redesign/Landing/__tests__/redesign-harness'
import {
    alternatives,
    availabilityStub,
    checkedNames,
    deferred,
    die,
    field,
    flowState,
    helpText,
    named,
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
const tap = async () => {
    await act(async () => {
        fireEvent.click(primary())
    })
    await advance(10)
}
/** Type a name, let its check answer 404, and wait for the button. */
const available = async (name = 'mellowfox') => {
    await type(name)
    await advance(800)
    expect(primary()).toBeEnabled()
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    disableDemoMode()
    // clearAllMocks keeps queued mock*Once answers; a test that fails before its tap would hand its answer to the next
    mockReserve.mockReset().mockResolvedValue('reserved')
    mockApiFetch.mockImplementation(availabilityStub({}, 404))
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    disableDemoMode()
})

describe('02 Username — demo path (C.md § 4.2)', () => {
    it.each(['demo', 'DEMO', ' Demo '])(
        'C-22 "%s" needs no check or reservation and opens the demo celebration',
        async (code) => {
            const { queryClient } = await mount()
            const before = checkedNames(mockApiFetch).length
            let userRequestAborted = false
            void queryClient
                .fetchQuery({
                    queryKey: [USER],
                    queryFn: ({ signal }) =>
                        new Promise((resolve) => {
                            signal.addEventListener('abort', () => {
                                userRequestAborted = true
                                resolve(null)
                            })
                        }),
                })
                .catch(() => {})

            await type(code)
            await advance(800)
            expect(primary()).toBeEnabled()
            expect(isDemoMode()).toBe(false)
            await tap()

            expect(isDemoMode()).toBe(true)
            expect(userRequestAborted).toBe(true)
            expect(queryClient.getQueryData([USER])).toEqual(DEMO_USER)
            expect(flowState()).toEqual(
                expect.objectContaining({
                    signupCompleted: true,
                    residenceCountry: 'BR',
                    nationalityCountry: '',
                    noBackLockScreenId: 'advantage-control',
                })
            )
            expect(mockSetScreenId).toHaveBeenCalledWith('advantage-control')
            expect(checkedNames(mockApiFetch)).toHaveLength(before)
            expect(mockReserve).not.toHaveBeenCalled()
            expect(mockHandleNext).not.toHaveBeenCalled()
        }
    )

    it('C-23 typing "demo" without a tap does not enable demo mode; "demos" and "demo1" take the normal check', async () => {
        const view = await mount()
        await type('demo')
        await advance(800)
        expect(isDemoMode()).toBe(false)
        expect(mockSetScreenId).not.toHaveBeenCalled()

        for (const name of ['demos', 'demo1']) {
            await type(name)
            await advance(800)
            expect(checkedNames(mockApiFetch)).toContain(name)
            expect(isDemoMode()).toBe(false)
        }
        view.unmount()
        expect(isDemoMode()).toBe(false)
    })
})

describe('02 Username — Claim (C.md § 4.2)', () => {
    it('C-24 two quick taps send one reservation; the button spins while pending; reserved advances once', async () => {
        const held = deferred<string>()
        mockReserve.mockReturnValueOnce(held.promise)
        await mount()
        await available()

        const button = primary()
        act(() => {
            fireEvent.click(button)
            fireEvent.click(button)
        })
        await advance(10)
        expect(mockReserve).toHaveBeenCalledTimes(1)
        expect(mockReserve).toHaveBeenCalledWith('mellowfox')
        expect(primary()).toBeDisabled()
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(controlsOf(capture()).filter((control) => control === 'claim:tap').length).toBeGreaterThanOrEqual(1)

        await act(async () => held.resolve('reserved'))
        await advance(10)
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('C-24 a reservation answering unavailable advances once, as dev', async () => {
        mockReserve.mockResolvedValueOnce('unavailable')
        await mount()
        await available()
        await tap()
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('C-24 a reservation answering taken shows the taken state with chips and stays', async () => {
        mockReserve.mockResolvedValueOnce('taken')
        mockApiFetch.mockImplementation(availabilityStub({ mellowfox: 404 }, 404))
        await mount()
        await available()
        await tap()
        await advance(1600)
        expect(setupState()).toBe('taken')
        expect(helpText()).toContain(loose(U('taken', { name: 'mellowfox' })))
        expect(alternatives()).not.toBeNull()
        expect(within(alternatives() as HTMLElement).getAllByRole('button').length).toBeGreaterThan(0)
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it.each(['refused', 'invalid'] as const)(
        'C-24 a reservation answering %s shows the reserved state and stays',
        async (result) => {
            mockReserve.mockResolvedValueOnce(result)
            await mount()
            await available()
            await tap()
            expect(setupState()).toBe('reserved')
            expect(helpText()).toContain(loose(U('reserved')))
            expect(primary()).toBeDisabled()
            expect(mockHandleNext).not.toHaveBeenCalled()
            if (result === 'refused') expect(controlsOf(capture())).toContain('username:error:refused')
        }
    )

    it('C-25 an edit while the reservation runs means no advance', async () => {
        const held = deferred<string>()
        mockReserve.mockReturnValueOnce(held.promise)
        await mount()
        await available()
        await tap()
        await type('mellowfoxy')
        await act(async () => held.resolve('reserved'))
        await advance(10)
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(field()).toHaveValue('mellowfoxy')
    })

    it('C-25 leaving the step while the reservation runs means no advance', async () => {
        const held = deferred<string>()
        mockReserve.mockReturnValueOnce(held.promise)
        const view = await mount()
        await available()
        await tap()
        view.unmount()
        await act(async () => held.resolve('reserved'))
        expect(mockHandleNext).not.toHaveBeenCalled()
    })
})

describe('02 Username — Enter / Go key (review R2-10)', () => {
    const enter = async () => {
        await act(async () => {
            fireEvent.keyDown(field(), { key: 'Enter' })
        })
        await advance(10)
    }

    it('Enter in the field claims the available name once, as the button does', async () => {
        await mount()
        await available('keyboardcat')
        expect(field()).toHaveAttribute('enterkeyhint', 'go')
        await enter()
        expect(mockReserve).toHaveBeenCalledTimes(1)
        expect(mockReserve).toHaveBeenCalledWith('keyboardcat')
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('Enter does nothing while the button is off (checking, invalid)', async () => {
        await mount()
        await type('keyboardcat')
        await enter()
        await type('9lucky')
        await advance(800)
        expect(primary()).toBeDisabled()
        await enter()
        expect(mockReserve).not.toHaveBeenCalled()
        expect(mockHandleNext).not.toHaveBeenCalled()
    })
})

describe('02 Username — privacy (C.md § 6)', () => {
    it('C-28 no analytics call carries the typed name, a suggestion or a chip name', async () => {
        mockApiFetch.mockImplementation(availabilityStub({ tiger: 200, tinytiger: 200 }, 404))
        await mount()
        const suggestion = (field() as HTMLInputElement).value
        await type('tiger')
        await advance(1600)
        const chips = within(alternatives() as HTMLElement)
            .getAllByRole('button')
            .map((chip) => loose(chip.textContent ?? '').replace(/^@/, ''))
        await act(async () => {
            fireEvent.click(within(alternatives() as HTMLElement).getByRole('button', { name: named(`@${chips[0]}`) }))
        })
        await advance(800)
        await act(async () => {
            fireEvent.click(die())
        })
        await advance(1600)
        const rolled = (field() as HTMLInputElement).value
        await tap()

        const sent = JSON.stringify(capture().mock.calls)
        const names = ['tiger', ...chips, suggestion, rolled].filter((name) => name && name.length >= 4)
        expect(names.length).toBeGreaterThanOrEqual(3)
        for (const name of names) expect(sent).not.toContain(name)
    })
})
