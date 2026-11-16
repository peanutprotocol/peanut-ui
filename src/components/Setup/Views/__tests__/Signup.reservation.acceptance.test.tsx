/** @jest-environment jsdom */
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
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen } from '@/test-utils/signup-controls'
import { setupScreenIds, setupSteps } from '@/components/Setup/Setup.consts'
import type { ScreenId } from '@/components/Setup/Setup.types'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { disableDemoMode, isDemoMode } from '@/utils/demo'
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

describe('Claim username reserves the name and moves on to Invite (failures 2, 18)', () => {
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
        'a 409 %s shows the taken error on the field and stays on Claim',
        async (code) => {
            mockReservationAnswer = { status: 409, body: { code } }
            renderClaim()
            await claim()
            expect(await screen.findByText('Username already taken')).toBeInTheDocument()
            expect(cursor()).toBe('signup')
            expect(mockHandleRegister).not.toHaveBeenCalled()
        }
    )

    it.each<[string, Answer]>([
        ['a network error', new TypeError('Failed to fetch')],
        ['a 500', { status: 500, body: { error: 'boom' } }],
        ['a 503', { status: 503 }],
        ['a 404 from an API without the endpoint', { status: 404 }],
    ])('advances to Invite without a reservation after %s', async (_label, answer) => {
        mockReservationAnswer = answer
        renderClaim()
        await claim()
        await waitFor(() => expect(cursor()).toBe('invite'))
        expect(reservationCalls()).toHaveLength(1)
        expect(screen.queryByText('Username already taken')).not.toBeInTheDocument()
        expect(mockHandleRegister).not.toHaveBeenCalled()
    })

    it('does not reserve a name the live check already found taken', async () => {
        mockAvailability = 200
        renderClaim()
        fireEvent.change(usernameField(), { target: { value: 'takenname' } })
        expect(await screen.findByText('Username already taken')).toBeInTheDocument()
        expect(claimButton()).toBeDisabled()
        fireEvent.click(claimButton())
        expect(reservationCalls()).toHaveLength(0)
        expect(cursor()).toBe('signup')
    })
})

describe('demo username (failure 14)', () => {
    it.each(['demo', ' Demo '])('%s still enters the demo without a reservation or a registration', async (code) => {
        renderClaim()
        await claim(code)
        await waitFor(() => expect(isDemoMode()).toBe(true))
        await waitFor(() => expect(cursor()).toBe('advantage-control' as ScreenId))
        expect(reservationCalls()).toHaveLength(0)
        expect(mockHandleRegister).not.toHaveBeenCalled()
    })
})
