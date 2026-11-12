/*
 * Spec-only behavioral coverage for the accepted reservation error decisions.
 * Fixture follows Signup.reservation.acceptance.test.tsx; production code was
 * not inspected when deriving these tests.
 */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/*
 * Acceptance tests for Claim username in the reordered signup
 * (spec: signup-reorder-spec.md, contract: username-reservation-contract.md).
 *
 * ── Guessed names / seams (align the implementation or adjust here) ──────
 * - The reservation request goes through apiFetch:
 *     apiFetch('/users/username/reservations', {
 *         method: 'POST', headers: { 'x-username-hold': <token> },
 *         body: JSON.stringify({ username }), includeAuth: false })
 *   The response is read from `status` and, for 409, `json()` → { code }.
 * - The holder token is 32 random bytes in base64url (43 chars), generated
 *   once per device and kept in localStorage.
 * - New screen id 'passkey' follows 'invite' in setupSteps.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Failure-list coverage: 2 (Claim side: reservation, taken/reserved stays),
 * 14 (demo username), 15 (no passkey events from Claim), 18 (UI use of the
 * reservation API, header, fallbacks). Registration is the passkey screen's
 * job, so useZeroDev is mocked here only to prove Claim never starts it.
 *
 * Not covered (spec silent): 400 USERNAME_INVALID, 400 HOLD_TOKEN_REQUIRED and
 * 429 RATE_LIMITED answers to the reservation.
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLayoutEffect, useState } from 'react'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen } from '@/test-utils/signup-controls'
import { setupScreenIds, setupSteps } from '@/components/Setup/Setup.consts'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { disableDemoMode } from '@/utils/demo'
import SignupStep from '../Signup'

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
jest.mock('@/hooks/useDebounce', () => ({ useDebounce: (value: string) => value }))
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const RESERVATIONS = '/users/username/reservations'
const HOLD_TOKEN = /^[A-Za-z0-9_-]{43}$/

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

const probe = {} as { cursor?: string; residence?: string }

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
    probe.cursor = flow.step?.screenId
    probe.residence = context.residenceCountry
    if (!ready) return null
    return (
        <>
            <output data-testid="cursor">{flow.step?.screenId}</output>
            {flow.step?.screenId === 'signup' && onSignupScreen('signup', <SignupStep />)}
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
const usernameField = () => screen.getByRole('textbox', { name: 'Username' })
const claimButton = () => screen.getByRole('button', { name: 'Claim' })

const claim = async (username = 'kimchi') => {
    fireEvent.change(usernameField(), { target: { value: username } })
    await waitFor(() => expect(claimButton()).toBeEnabled())
    await act(async () => {
        fireEvent.click(claimButton())
    })
}

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    disableDemoMode()
    mockAvailability = 404
    mockReservationAnswer = { status: 200, body: { username: 'kimchi', expiresAt: '2026-11-12T10:30:00Z' } }
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

describe('Claim reservation errors and duplicate submission', () => {
    it('shows a field error and stays on Claim when the server rejects an invalid username', async () => {
        mockReservationAnswer = { status: 400, body: { code: 'USERNAME_INVALID', reason: 'reserved' } }
        renderClaim()
        await claim()

        expect(await screen.findByText(/invalid|not allowed|valid username|username must/i)).toBeVisible()
        expect(cursor()).toBe('signup')
        expect(usernameField()).toHaveValue('kimchi')
        expect(reservationCalls()).toHaveLength(1)
        expect(mockHandleRegister).not.toHaveBeenCalled()
    })

    // The API refuses NEW names that contain "peanut" or impersonate support
    // with this reason; Claim names the cause instead of "invalid".
    it('shows the reserved-name refusal as the field error and stays on Claim', async () => {
        mockReservationAnswer = { status: 400, body: { code: 'USERNAME_INVALID', reason: 'This username is reserved' } }
        renderClaim()
        await claim('mypeanut')

        expect(await screen.findByText('This username is reserved. Try a different one.')).toBeVisible()
        expect(screen.queryByText('Username is invalid, please use a different one')).not.toBeInTheDocument()
        expect(cursor()).toBe('signup')
        expect(usernameField()).toHaveValue('mypeanut')
        expect(reservationCalls()).toHaveLength(1)
        expect(mockHandleRegister).not.toHaveBeenCalled()
    })

    it('regenerates the rejected hold token once, retries the same username, and advances on success', async () => {
        let attempts = 0
        mockApiFetch.mockImplementation(async (path: string) => {
            if (path !== RESERVATIONS) return respond(404)
            attempts += 1
            return attempts === 1
                ? respond(400, { code: 'HOLD_TOKEN_REQUIRED' })
                : respond(200, { username: 'kimchi', expiresAt: '2026-11-12T10:30:00Z' })
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

    it('advances without a reservation or retries when rate limited', async () => {
        mockReservationAnswer = { status: 429, body: { code: 'RATE_LIMITED' } }
        renderClaim()
        await claim()
        await waitFor(() => expect(cursor()).toBe('invite'))

        expect(reservationCalls()).toHaveLength(1)
        expect(mockHandleRegister).not.toHaveBeenCalled()
    })

    it('makes one reservation and advances once when Claim is clicked twice before the response', async () => {
        let resolveReservation!: (value: ReturnType<typeof respond>) => void
        const pendingReservation = new Promise<ReturnType<typeof respond>>((resolve) => {
            resolveReservation = resolve
        })
        mockApiFetch.mockImplementation(async (path: string) =>
            path === RESERVATIONS ? pendingReservation : respond(404)
        )
        renderClaim()
        fireEvent.change(usernameField(), { target: { value: 'kimchi' } })
        await waitFor(() => expect(claimButton()).toBeEnabled())
        const button = claimButton()

        // Same-turn clicks challenge the latch before React commits disabled state.
        act(() => {
            fireEvent.click(button)
            fireEvent.click(button)
        })
        await waitFor(() => expect(reservationCalls()).toHaveLength(1))
        expect(cursor()).toBe('signup')
        fireEvent.click(button)
        expect(reservationCalls()).toHaveLength(1)

        await act(async () => {
            resolveReservation(respond(200, { username: 'kimchi', expiresAt: '2026-11-12T10:30:00Z' }))
            await pendingReservation
        })
        await waitFor(() => expect(cursor()).toBe('invite'))
        expect(reservationCalls()).toHaveLength(1)
        expect(mockHandleRegister).not.toHaveBeenCalled()
        expect(probe.residence).toBe('AR')
    })
})
