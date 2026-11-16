/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/*
 * 02 Username: the reservation end to end, with the real `reserveUsername` and hold token behind a stubbed
 * `apiFetch` (spec: signup-reorder-spec.md, contract: username-reservation-contract.md, sign-up redesign
 * contract C § 4.2). Ported from dev's `Views/__tests__/Signup.reservation.acceptance.test.tsx` and
 * `Signup.reservation-errors.test.tsx` when the old Claim view was deleted: the cases below are the ones the
 * component checks (C-22…C-25, which stub `reserveUsername`) do not cover.
 *
 * The step comes from the registry (`signup`) and renders inside the real SetupShell, whose footer holds the
 * button ("Use @<name>" once a typed name is free).
 *
 * Failure-list coverage: 2 (reservation, taken stays), 14 (demo), 15 (no passkey events from 02), 18 (header,
 * token regeneration, fallbacks, one reservation per double tap).
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLayoutEffect, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { renderWithIntl } from '@/test-utils/intl'
import { SetupShell } from '@/components/Setup/redesign/shell/SetupShell'
import { setupScreenIds, setupSteps } from '@/components/Setup/Setup.consts'
import type { ScreenId } from '@/components/Setup/Setup.types'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { disableDemoMode, isDemoMode } from '@/utils/demo'
import en from '@/i18n/app/messages/en.json'

type FetchInit = { method?: string; headers?: unknown; body?: unknown } | undefined
type Answer = { status: number; body?: unknown } | Error

const mockApiFetch = jest.fn()
const mockHandleRegister = jest.fn()
let mockAvailability = 404
let mockReservationAnswer: Answer = { status: 200, body: { username: 'kimchi', expiresAt: '2026-11-12T10:30:00Z' } }

jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleRegister: mockHandleRegister, address: undefined, isRegistering: false }),
}))
jest.mock('@/hooks/useLogin', () => ({ useLogin: () => ({ handleLoginClick: jest.fn(), isLoggingIn: false }) }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { WEB: 'web', IOS: 'ios', ANDROID: 'android' },
    useDeviceType: () => ({ deviceType: 'android' }),
}))
jest.mock('@/utils/passkeyPreflight', () => ({ checkPasskeySupport: async () => ({ isSupported: true }) }))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({ latestCeremony: () => undefined }))
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: () => false,
    isNativeBridge: () => false,
    isIOSNativeBridge: () => false,
    isAndroidNativeBridge: () => false,
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null, fetchUser: jest.fn() }) }))
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), onFeatureFlags: jest.fn(() => () => {}), isFeatureEnabled: jest.fn(() => false) },
}))
// art only: the Lottie player has nothing to draw in jsdom
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))

const RESERVATIONS = '/users/username/reservations'
const HOLD_TOKEN = /^[A-Za-z0-9_-]{43}$/
const RESERVED = { username: 'kimchi', expiresAt: '2026-11-12T10:30:00Z' }
/** 02 checks a typed name 750 ms after the last edit, then names the button. */
const CHECKED = { timeout: 3000 }
/** Testing Library normalizes the page's no-break spaces to spaces; the catalog keeps them. */
const plain = (text: string) => text.replace(/\u00a0/g, ' ')
const takenLine = (name: string) => plain(en.setupRedesign.username.taken.replace('{name}', name))

const respond = (status: number, body?: unknown) => ({
    status,
    ok: status >= 200 && status < 300,
    url: '',
    json: async () => body ?? {},
    text: async () => JSON.stringify(body ?? {}),
    clone() {
        return this
    },
})

function headerOf(init: FetchInit, name: string): string | null {
    const headers = init?.headers
    if (!headers) return null
    if (typeof (headers as { get?: unknown }).get === 'function') return (headers as Headers).get(name)
    const entries = Array.isArray(headers) ? headers : Object.entries(headers as Record<string, string>)
    const match = (entries as [string, string][]).find(([key]) => key.toLowerCase() === name)
    return match ? match[1] : null
}

const reservationCalls = () =>
    mockApiFetch.mock.calls.filter(
        ([path, init]) => path === RESERVATIONS && ((init as FetchInit)?.method ?? 'GET').toUpperCase() === 'POST'
    ) as [string, FetchInit][]

const probe = {} as { residence?: string }

function Host() {
    const context = useSetupFlowContext()
    const flow = useSetupFlow()
    const [ready, setReady] = useState(false)
    useLayoutEffect(() => {
        context.setSteps(setupSteps)
        context.setResidenceCountry('AR')
        setReady(true)
        // seed once, as the layout does
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    probe.residence = context.residenceCountry
    if (!ready) return null
    const id = flow.step?.screenId
    const Step = flow.step?.component
    return (
        <>
            <output data-testid="cursor">{id}</output>
            {id === 'signup' && Step && (
                <SetupShell screenId={id}>
                    <Step />
                </SetupShell>
            )}
        </>
    )
}

const renderClaim = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return renderWithIntl(
        <QueryClientProvider client={queryClient}>
            <NuqsTestingAdapter hasMemory searchParams={{ screen: 'signup' }}>
                <SetupFlowProvider masterScreenIds={setupScreenIds}>
                    <Host />
                </SetupFlowProvider>
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
}

const cursor = () => screen.getByTestId('cursor').textContent
const usernameField = () => screen.getByRole('textbox', { name: en.setupRedesign.username.fieldAria })
const useButton = (name: string) =>
    screen.getByRole('button', { name: en.setupRedesign.username.ctaNamed.replace('{name}', name) })

const claim = async (username = 'kimchi') => {
    fireEvent.change(usernameField(), { target: { value: username } })
    const name = username.trim().toLowerCase()
    await waitFor(() => expect(useButton(name)).toBeEnabled(), CHECKED)
    await act(async () => {
        fireEvent.click(useButton(name))
    })
}

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    disableDemoMode()
    mockAvailability = 404
    mockReservationAnswer = { status: 200, body: RESERVED }
    mockApiFetch.mockImplementation(async (path: string, init: FetchInit) => {
        if (path === RESERVATIONS) {
            if (mockReservationAnswer instanceof Error) throw mockReservationAnswer
            return respond(mockReservationAnswer.status, mockReservationAnswer.body)
        }
        if (path.startsWith('/users/username/')) return respond(mockAvailability)
        throw new Error(`unexpected request ${init?.method ?? 'GET'} ${path}`)
    })
})
afterEach(() => disableDemoMode())

describe('02 reserves the name and moves on to Invite (failures 2, 18)', () => {
    it('reserves the claimed name with the device hold token, then advances to Invite without registering', async () => {
        renderClaim()
        await claim()
        await waitFor(() => expect(cursor()).toBe('invite'))

        expect(reservationCalls()).toHaveLength(1)
        const [, init] = reservationCalls()[0]
        expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({ username: 'kimchi' }))
        expect(headerOf(init, 'x-username-hold')).toMatch(HOLD_TOKEN)

        expect(mockHandleRegister).not.toHaveBeenCalled()
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_PASSKEY_STARTED, expect.anything())
        expect(probe.residence).toBe('AR')
    })

    it('keeps one hold token per device: a second claim after a reload sends the same token', async () => {
        const first = renderClaim()
        await claim()
        await waitFor(() => expect(cursor()).toBe('invite'))
        first.unmount()

        renderClaim()
        await claim('kimchi2')
        await waitFor(() => expect(cursor()).toBe('invite'))

        const [a, b] = reservationCalls().map(([, init]) => headerOf(init, 'x-username-hold'))
        expect(a).toMatch(HOLD_TOKEN)
        expect(b).toBe(a)
    })

    it('never sends the hold token to analytics', async () => {
        renderClaim()
        await claim()
        await waitFor(() => expect(cursor()).toBe('invite'))
        const token = headerOf(reservationCalls()[0][1], 'x-username-hold') as string
        expect(token).toMatch(HOLD_TOKEN)
        expect(JSON.stringify((posthog.capture as jest.Mock).mock.calls)).not.toContain(token)
    })

    it.each([['USERNAME_TAKEN'], ['USERNAME_RESERVED']])(
        'a 409 %s shows the taken line on the field and stays on 02',
        async (code) => {
            mockReservationAnswer = { status: 409, body: { code } }
            renderClaim()
            await claim()
            expect(await screen.findByText(takenLine('kimchi'))).toBeVisible()
            expect(document.querySelector('[data-setup-state]')).toHaveAttribute('data-setup-state', 'taken')
            expect(cursor()).toBe('signup')
            expect(mockHandleRegister).not.toHaveBeenCalled()
        }
    )

    it.each<[string, Answer]>([
        ['a network error', new TypeError('Failed to fetch')],
        ['a 500', { status: 500, body: { error: 'boom' } }],
        ['a 503', { status: 503 }],
        ['a 404 from an API without the endpoint', { status: 404 }],
        ['a 429 rate limit', { status: 429, body: { code: 'RATE_LIMITED' } }],
    ])('advances to Invite without a reservation or a retry after %s', async (_label, answer) => {
        mockReservationAnswer = answer
        renderClaim()
        await claim()
        await waitFor(() => expect(cursor()).toBe('invite'))
        expect(reservationCalls()).toHaveLength(1)
        expect(mockHandleRegister).not.toHaveBeenCalled()
    })

    it('does not reserve a name the live check already found taken', async () => {
        renderClaim()
        mockAvailability = 200
        fireEvent.change(usernameField(), { target: { value: 'takenname' } })
        expect(await screen.findByText(takenLine('takenname'), {}, CHECKED)).toBeInTheDocument()
        const button = screen.getByRole('button', { name: en.setupRedesign.username.cta })
        expect(button).toBeDisabled()
        fireEvent.click(button)
        expect(reservationCalls()).toHaveLength(0)
        expect(cursor()).toBe('signup')
    })
})

describe('reservation refusals and the hold token', () => {
    it.each([
        ['USERNAME_RESERVED', { code: 'USERNAME_RESERVED' }],
        [
            'USERNAME_INVALID with the reserved reason',
            { code: 'USERNAME_INVALID', reason: 'This username is reserved' },
        ],
        ['USERNAME_INVALID', { code: 'USERNAME_INVALID', reason: 'reserved' }],
    ])('a 400 %s shows the reserved line and stays on 02 with the name', async (_label, body) => {
        mockReservationAnswer = { status: 400, body }
        renderClaim()
        await claim('kimchi')
        expect(await screen.findByText(en.setupRedesign.username.reserved)).toBeVisible()
        expect(document.querySelector('[data-setup-state]')).toHaveAttribute('data-setup-state', 'reserved')
        expect(cursor()).toBe('signup')
        expect(usernameField()).toHaveValue('kimchi')
        expect(reservationCalls()).toHaveLength(1)
        expect(mockHandleRegister).not.toHaveBeenCalled()
    })

    it('regenerates the rejected hold token once, retries the same username, and advances on success', async () => {
        let attempts = 0
        mockApiFetch.mockImplementation(async (path: string) => {
            if (path !== RESERVATIONS) return respond(404)
            attempts += 1
            return attempts === 1 ? respond(400, { code: 'HOLD_TOKEN_REQUIRED' }) : respond(200, RESERVED)
        })
        const first = renderClaim()
        await claim()
        await waitFor(() => expect(cursor()).toBe('invite'))

        expect(reservationCalls()).toHaveLength(2)
        const [initial, retried] = reservationCalls()
        const initialToken = headerOf(initial[1], 'x-username-hold')
        const retriedToken = headerOf(retried[1], 'x-username-hold')
        expect(initialToken).toMatch(HOLD_TOKEN)
        expect(retriedToken).toMatch(HOLD_TOKEN)
        expect(retriedToken).not.toBe(initialToken)
        expect(JSON.parse(String(retried[1]?.body))).toEqual(expect.objectContaining({ username: 'kimchi' }))
        expect(mockHandleRegister).not.toHaveBeenCalled()

        // The replacement becomes the device token, surviving a screen reload.
        first.unmount()
        renderClaim()
        await claim('kimchi2')
        await waitFor(() => expect(cursor()).toBe('invite'))
        expect(reservationCalls()).toHaveLength(3)
        expect(headerOf(reservationCalls()[2][1], 'x-username-hold')).toBe(retriedToken)
    })

    it('stops after one token regeneration and advances when the replacement is rejected too', async () => {
        mockReservationAnswer = { status: 400, body: { code: 'HOLD_TOKEN_REQUIRED' } }
        renderClaim()
        await claim()
        await waitFor(() => expect(cursor()).toBe('invite'))

        expect(reservationCalls()).toHaveLength(2)
        const [initialToken, replacementToken] = reservationCalls().map(([, init]) => headerOf(init, 'x-username-hold'))
        expect(initialToken).toMatch(HOLD_TOKEN)
        expect(replacementToken).toMatch(HOLD_TOKEN)
        expect(replacementToken).not.toBe(initialToken)
        expect(mockHandleRegister).not.toHaveBeenCalled()
    })

    it('makes one reservation and advances once when the button is tapped twice before the response', async () => {
        let resolveReservation!: (value: ReturnType<typeof respond>) => void
        const pendingReservation = new Promise<ReturnType<typeof respond>>((resolve) => {
            resolveReservation = resolve
        })
        mockApiFetch.mockImplementation(async (path: string) =>
            path === RESERVATIONS ? pendingReservation : respond(404)
        )
        renderClaim()
        fireEvent.change(usernameField(), { target: { value: 'kimchi' } })
        await waitFor(() => expect(useButton('kimchi')).toBeEnabled(), CHECKED)
        const button = useButton('kimchi')

        // Same-turn taps challenge the latch before React commits the disabled state.
        act(() => {
            fireEvent.click(button)
            fireEvent.click(button)
        })
        await waitFor(() => expect(reservationCalls()).toHaveLength(1))
        expect(cursor()).toBe('signup')
        fireEvent.click(button)
        expect(reservationCalls()).toHaveLength(1)

        await act(async () => {
            resolveReservation(respond(200, RESERVED))
            await pendingReservation
        })
        await waitFor(() => expect(cursor()).toBe('invite'))
        expect(reservationCalls()).toHaveLength(1)
        expect(mockHandleRegister).not.toHaveBeenCalled()
        expect(probe.residence).toBe('AR')
    })
})

describe('demo username (failure 14)', () => {
    it.each(['demo', ' Demo '])('%s still enters the demo without a reservation or a registration', async (code) => {
        renderClaim()
        fireEvent.change(usernameField(), { target: { value: code } })
        const button = await screen.findByRole('button', { name: /^Use @demo$/i })
        await waitFor(() => expect(button).toBeEnabled())
        await act(async () => {
            fireEvent.click(button)
        })
        await waitFor(() => expect(isDemoMode()).toBe(true))
        await waitFor(() => expect(cursor()).toBe('advantage-control' as ScreenId))
        expect(reservationCalls()).toHaveLength(0)
        expect(mockHandleRegister).not.toHaveBeenCalled()
    })
})
