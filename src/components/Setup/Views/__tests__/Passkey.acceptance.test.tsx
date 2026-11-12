/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/*
 * Acceptance tests for the new Passkey screen (spec: signup-reorder-spec.md,
 * contract: username-reservation-contract.md).
 *
 * ── Guessed names / seams (align the implementation or adjust here) ──────
 * - The screen is the setupSteps entry with screenId 'passkey'; this file
 *   renders it from the registry, so its module path does not matter.
 * - Registration still goes through useZeroDev().handleRegister(username)
 *   (mocked here; useZeroDev.username-hold.acceptance.test.tsx covers the
 *   header on the registration requests). The mock settles the invite stash
 *   the way the real handleRegister does after hydration, so either place
 *   for accepting the stored selection passes.
 * - The reservation refresh on mount goes through apiFetch:
 *     apiFetch('/users/username/reservations', { method: 'POST',
 *         headers: { 'x-username-hold': <token> }, body: JSON.stringify({ username }) })
 * - Answers are flushed with the existing updateUserById server action
 *   (saveSignupResidence / saveSignupPaymentPlan or one merged call).
 * - Failure 5: `flushPendingSignupAnswers(userId)` exported from
 *   '@/features/setup/saveSignupAnswers' retries a durable pending save
 *   (e.g. on the next app start) and resolves when done. Loaded at runtime
 *   below so the rest of this file compiles without it.
 * - Copy: en strings from the spec; the passkey step's title and subtitle may
 *   come from steps.passkey.* (SetupWrapper chrome) or the view itself.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Assumptions where the spec is not explicit:
 * - Registration reports the name taken while the public lookup says it is
 *   not registered → someone else holds it → back to Claim (failure 2). When
 *   the lookup says it is registered → the existing Log in branch (16).
 * - A refresh on mount that fails with a network error or 5xx keeps the
 *   person on the passkey screen (registration is the server backstop).
 * - A failed answer save or inviter acceptance does not hold the person on
 *   the passkey screen; both retry separately.
 *
 * Failure-list coverage: 2, 3, 4, 5, 6, 10 (acceptance only after the account
 * exists), 15 (passkey events from this screen), 16, 18 (refresh on mount).
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { useLayoutEffect, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen, signupControls } from '@/test-utils/signup-controls'
import { setupScreenIds, setupSteps } from '@/components/Setup/Setup.consts'
import type { ScreenId } from '@/components/Setup/Setup.types'
import { SetupDocsProvider, type SetupDocuments } from '@/components/Setup/components/SetupDocsDrawer'
import { useSetupStepCopy } from '@/components/Setup/useSetupStepCopy'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { __resetSignupSavesForTests } from '@/features/setup/saveSignupAnswers'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { settlePendingInviteAttribution } from '@/services/pending-invite-attribution'
import { EInviteType } from '@/services/services.types'
import { CeremonyTimeoutError } from '@/utils/passkeyCeremony.utils'
import { readInviteCode } from '@/utils/invite-stash'
import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'

type FetchInit = { method?: string; headers?: unknown; body?: unknown } | undefined
type Answer = { status: number; body?: unknown } | Error
type SessionUser = { user: { userId: string; username: string }; accounts: { type: string }[] }
type Session = { address: string | undefined; user: SessionUser | null; isRegistering: boolean }

const mockSession = (() => {
    const initial: Session = { address: undefined, user: null, isRegistering: false }
    let state = initial
    const listeners = new Set<() => void>()
    return {
        get: () => state,
        set: (patch: Partial<Session>) => {
            state = { ...state, ...patch }
            listeners.forEach((listener) => listener())
        },
        subscribe: (listener: () => void) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        reset: () => {
            state = initial
        },
    }
})()
const mockHandleRegister = jest.fn()
const mockLogin = jest.fn()
const mockFetchUser = jest.fn(async () => null)
const mockApiFetch = jest.fn()
const mockUpdateUser = jest.fn()
const mockValidateInviter = jest.fn()
const mockAcceptInvite = jest.fn()

jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => {
        const { useSyncExternalStore } = jest.requireActual<typeof import('react')>('react')
        const state = useSyncExternalStore(mockSession.subscribe, mockSession.get)
        return {
            handleRegister: (username: string) => mockHandleRegister(username),
            address: state.address,
            isRegistering: state.isRegistering,
        }
    },
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => {
        const { useSyncExternalStore } = jest.requireActual<typeof import('react')>('react')
        const state = useSyncExternalStore(mockSession.subscribe, mockSession.get)
        return { user: state.user, fetchUser: mockFetchUser, isFetchingUser: false }
    },
}))
jest.mock('@/hooks/useLogin', () => ({ useLogin: () => ({ handleLoginClick: mockLogin, isLoggingIn: false }) }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { WEB: 'web', IOS: 'ios', ANDROID: 'android' },
    useDeviceType: () => ({ deviceType: 'android' }),
}))
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: () => false,
    isNativeBridge: () => false,
    isIOSNativeBridge: () => false,
    isAndroidNativeBridge: () => false,
    openExternalUrl: jest.fn(),
}))
jest.mock('@/utils/passkeyPreflight', () => ({ checkPasskeySupport: async () => ({ isSupported: true }) }))
jest.mock('@/utils/passkeyDebug', () => ({ capturePasskeyDebugInfo: jest.fn() }))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({ latestCeremony: () => undefined }))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/app/actions/users', () => ({ updateUserById: (...args: unknown[]) => mockUpdateUser(...args) }))
jest.mock('@/services/invites', () => ({
    invitesApi: {
        validateInviteCode: (...args: unknown[]) => mockValidateInviter(...args),
        acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args),
    },
}))
jest.mock('@/services/invite-acquisition', () => ({
    settleAcceptedInviteAcquisition: () => ({ destination: '/home', pending: [] }),
}))
jest.mock('@/hooks/useDebounce', () => ({ useDebounce: (value: string) => value }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const PASSKEY = 'passkey' as ScreenId
const RESERVATIONS = '/users/username/reservations'
const HOLD_TOKEN = /^[A-Za-z0-9_-]{43}$/
const NEW_USER: SessionUser = { user: { userId: 'new-user', username: 'kimchi' }, accounts: [] }
const ATTRIBUTED = { success: true, attributionResolved: true, onboardingResolved: true, claims: [] }
const RETRYABLE = {
    success: false,
    retryable: true,
    status: 503,
    attributionResolved: false,
    onboardingResolved: false,
    claims: [],
}

let mockAvailability: number | Promise<number> = 404
let mockReservationAnswer: Answer = { status: 200, body: { username: 'kimchi', expiresAt: '2026-11-12T10:30:00Z' } }

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

/** Every field the account received, merged across calls. */
const savedFor = (userId: string) =>
    Object.assign(
        {},
        ...mockUpdateUser.mock.calls
            .map(([payload]) => payload as Record<string, unknown>)
            .filter((payload) => payload.userId === userId)
    )

const doc = (title: string) => ({ title, content: <p>{title} body</p> })
const localized = (title: string) => ({
    en: doc(title),
    'es-419': doc(title),
    'es-ar': doc(title),
    'pt-br': doc(title),
})
const DOCUMENTS: SetupDocuments = {
    terms: doc('Terms'),
    privacy: doc('Privacy'),
    'account-recovery': localized('Account recovery'),
    passkeys: localized('Passkeys guide'),
}

const probe = {} as {
    flow: ReturnType<typeof useSetupFlow>
    context: ReturnType<typeof useSetupFlowContext>
}
const RENDERED = ['invite', 'passkey', 'signup']

function Host() {
    const context = useSetupFlowContext()
    const flow = useSetupFlow()
    const [ready, setReady] = useState(false)
    useLayoutEffect(() => {
        context.setSteps(setupSteps)
        // Everything answered before the passkey screen in the new order.
        context.setUsername('kimchi')
        context.setResidenceCountry('AR')
        context.setNationalityCountry('BR')
        context.setFundingChannel('arsBank')
        context.setPaymentChannel('qr')
        setReady(true)
        // seed once, as the earlier screens would have
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const step = flow.step
    const copy = useSetupStepCopy(step)
    probe.flow = flow
    probe.context = context
    if (!ready) return null
    const id = step?.screenId as string | undefined
    const Step = step?.component
    return (
        <>
            <output data-testid="cursor">{id}</output>
            {Step && id && RENDERED.includes(id) && id !== 'signup' && (
                <section>
                    {copy.title && <h1>{copy.title}</h1>}
                    {copy.description && <div>{copy.description}</div>}
                    {onSignupScreen(id as ScreenId, <Step />)}
                </section>
            )}
        </>
    )
}

const renderAt = (start: 'passkey' | 'invite' = 'passkey') =>
    renderWithIntl(
        <NuqsTestingAdapter hasMemory searchParams={{ screen: start }}>
            <SetupFlowProvider masterScreenIds={setupScreenIds}>
                <SetupDocsProvider documents={DOCUMENTS}>
                    <Host />
                </SetupDocsProvider>
            </SetupFlowProvider>
        </NuqsTestingAdapter>
    )

const cursor = () => screen.getByTestId('cursor').textContent
const createButton = () => screen.getByRole('button', { name: 'Create passkey', hidden: true })
const tap = async () => {
    await act(async () => {
        fireEvent.click(createButton())
    })
}
const events = (name: string) => (posthog.capture as jest.Mock).mock.calls.filter(([event]) => event === name)

const selectInviter = async (value: string) => {
    const field = screen.getByRole('textbox', { name: 'Username of the person who invited you' })
    fireEvent.change(field, { target: { value } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled())
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    })
    await waitFor(() => expect(cursor()).toBe('passkey'))
}

/** What the real handleRegister does once the server verified: session, invite settlement, wallet address. */
const registerSucceeds = async () => {
    mockSession.set({ user: NEW_USER })
    await settlePendingInviteAttribution(NEW_USER.user.userId, 'registration')
    mockSession.set({ address: '0xnew' })
}

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    mockSession.reset()
    __resetSignupSavesForTests()
    mockAvailability = 404
    mockReservationAnswer = { status: 200, body: { username: 'kimchi', expiresAt: '2026-11-12T10:30:00Z' } }
    mockHandleRegister.mockImplementation(registerSucceeds)
    mockUpdateUser.mockResolvedValue({ data: {} })
    mockValidateInviter.mockResolvedValue({ success: true, attributionResolved: true })
    mockAcceptInvite.mockResolvedValue(ATTRIBUTED)
    mockApiFetch.mockImplementation(async (path: string, init: FetchInit) => {
        if (path === RESERVATIONS) {
            if (mockReservationAnswer instanceof Error) throw mockReservationAnswer
            return respond(mockReservationAnswer.status, mockReservationAnswer.body)
        }
        if (path.startsWith('/users/username/')) return respond(await mockAvailability)
        throw new Error(`unexpected request ${init?.method ?? 'GET'} ${path}`)
    })
})

describe('the passkey screen', () => {
    it('explains passkeys and offers Create passkey and Learn more', async () => {
        renderAt()
        expect(await screen.findByRole('button', { name: 'Create passkey' })).toBeInTheDocument()
        expect(screen.getByText('Create your passkey')).toBeInTheDocument()
        expect(
            screen.getByText('It’s how you sign in and approve payments. No password to remember.', {
                normalizer: (text) => text.replace(/['’]/g, '’').trim(),
            })
        ).toBeInTheDocument()
        for (const text of [
            /Your face or fingerprint/,
            /Unlock with what your phone already uses\./,
            /Only you control it/,
            /Peanut never sees or stores it\./,
            /Ready on a new phone/,
            /Saved to your Google or Apple account\./,
        ]) {
            expect(screen.getByText(text)).toBeInTheDocument()
        }
        expect(screen.getByRole('button', { name: /learn more about passkeys/i })).toBeInTheDocument()
    })

    it('opens the passkeys guide from Learn more, reported from the passkey screen', async () => {
        renderAt()
        fireEvent.click(await screen.findByRole('button', { name: /learn more about passkeys/i }))
        expect(await screen.findByRole('dialog')).toHaveTextContent('Passkeys guide')
        const opened = (posthog.capture as jest.Mock).mock.calls.find(
            ([event, props]) => event === ANALYTICS_EVENTS.CONTROL_USED && props.control === 'passkeys_doc'
        )
        expect(opened?.[1]).toEqual(expect.objectContaining({ screen_id: 'passkey', action: 'open' }))
        expect(mockHandleRegister).not.toHaveBeenCalled()
    })

    it('ships the screen copy in en, es-419 and pt-BR', () => {
        const pathTo = (node: unknown, value: string, path: string[] = []): string[] | null => {
            if (node === value) return path
            if (!node || typeof node !== 'object') return null
            for (const [key, child] of Object.entries(node)) {
                const found = pathTo(child, value, [...path, key])
                if (found) return found
            }
            return null
        }
        const at = (catalog: unknown, path: string[]) =>
            path.reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], catalog)
        for (const english of ['Create your passkey', 'Create passkey']) {
            const path = pathTo(en, english)
            expect(path).not.toBeNull()
            for (const catalog of [es419, ptBR]) {
                const translated = at(catalog, path as string[])
                expect(typeof translated).toBe('string')
                expect((translated as string).trim()).not.toBe('')
            }
        }
    })
})

describe('one tap, one registration (failure 4)', () => {
    it('one tap opens the passkey sheet directly and reports the start from this screen', async () => {
        renderAt()
        await screen.findByRole('button', { name: 'Create passkey' })
        await tap()
        await waitFor(() => expect(mockHandleRegister).toHaveBeenCalledTimes(1))
        expect(mockHandleRegister).toHaveBeenCalledWith('kimchi')
        expect(events(ANALYTICS_EVENTS.SIGNUP_PASSKEY_STARTED)).toEqual([
            [ANALYTICS_EVENTS.SIGNUP_PASSKEY_STARTED, expect.objectContaining({ device_type: 'android' })],
        ])
    })

    it('ignores extra taps while the checks before the ceremony are still running', async () => {
        let release!: (status: number) => void
        mockAvailability = new Promise<number>((resolve) => {
            release = resolve
        })
        mockHandleRegister.mockImplementation(() => new Promise(() => {}))
        renderAt()
        await screen.findByRole('button', { name: 'Create passkey' })
        await tap()
        await tap()
        await tap()
        await act(async () => release(404))
        await waitFor(() => expect(mockHandleRegister).toHaveBeenCalledTimes(1))
        await tap()
        expect(mockHandleRegister).toHaveBeenCalledTimes(1)
    })
})

describe('the reservation (failures 2, 18)', () => {
    it('refreshes the reservation with the device hold token when the screen opens', async () => {
        renderAt()
        await waitFor(() => expect(reservationCalls()).toHaveLength(1))
        const [, init] = reservationCalls()[0]
        expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({ username: 'kimchi' }))
        expect(headerOf(init, 'x-username-hold')).toMatch(HOLD_TOKEN)
        expect(mockHandleRegister).not.toHaveBeenCalled()
        expect(cursor()).toBe('passkey')
    })

    it('goes back to Claim username, keeping every other answer, when someone else now holds the name', async () => {
        mockReservationAnswer = { status: 409, body: { code: 'USERNAME_RESERVED' } }
        renderAt()
        await waitFor(() => expect(cursor()).toBe('signup'))
        expect(probe.context).toEqual(
            expect.objectContaining({
                residenceCountry: 'AR',
                nationalityCountry: 'BR',
                fundingChannel: 'arsBank',
                paymentChannel: 'qr',
            })
        )
        expect(mockHandleRegister).not.toHaveBeenCalled()
    })

    it.each<[string, Answer]>([
        ['a refreshed reservation', { status: 200, body: { username: 'kimchi', expiresAt: '2026-11-12T10:30:00Z' } }],
        ['a server error', { status: 500 }],
        ['a network error', new TypeError('Failed to fetch')],
    ])('stays on the passkey screen after %s', async (_label, answer) => {
        mockReservationAnswer = answer
        renderAt()
        await waitFor(() => expect(reservationCalls()).toHaveLength(1))
        await act(async () => {})
        expect(cursor()).toBe('passkey')
        expect(createButton()).toBeEnabled()
    })

    it('goes back to Claim username when registration finds the name held by someone else', async () => {
        mockHandleRegister.mockRejectedValue(
            Object.assign(new Error('Username already taken'), { name: 'UsernameTaken' })
        )
        renderAt()
        await screen.findByRole('button', { name: 'Create passkey' })
        await tap()
        await waitFor(() => expect(cursor()).toBe('signup'))
        expect(mockHandleRegister).toHaveBeenCalledTimes(1)
        expect(probe.context).toEqual(
            expect.objectContaining({
                residenceCountry: 'AR',
                nationalityCountry: 'BR',
                fundingChannel: 'arsBank',
                paymentChannel: 'qr',
            })
        )
    })
})

describe('username already registered → Log in, on the passkey screen (failure 16)', () => {
    it('offers Log in instead of a ceremony when the name is already registered', async () => {
        mockAvailability = 200
        renderAt()
        await screen.findByRole('button', { name: 'Create passkey' })
        await tap()
        expect(await screen.findByText(/This username is already registered/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
        expect(mockLogin).toHaveBeenCalledTimes(1)
        expect(mockHandleRegister).not.toHaveBeenCalled()
        expect(cursor()).toBe('passkey')
        expect(events(ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED)).toEqual([
            [ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED, expect.objectContaining({ error_code: 'USERNAME_TAKEN' })],
        ])
    })
})

describe('the account may exist after a failed verify or hydration (failure 3)', () => {
    it.each([
        ['a ceremony timeout', () => new CeremonyTimeoutError(60000)],
        ['a failed session hydration', () => new Error('Session hydration failed')],
    ])('after %s, checks the account and offers Log in instead of registering again', async (_label, error) => {
        mockHandleRegister.mockImplementation(async () => {
            // the server verified the passkey and created the account before the client gave up
            mockAvailability = 200
            throw error()
        })
        renderAt()
        await screen.findByRole('button', { name: 'Create passkey' })
        await tap()
        await waitFor(() => expect(mockHandleRegister).toHaveBeenCalledTimes(1))
        await tap()
        expect(await screen.findByText(/This username is already registered/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Log in', hidden: true })).toBeInTheDocument()
        expect(mockHandleRegister).toHaveBeenCalledTimes(1)
        expect(cursor()).toBe('passkey')
    })
})

describe('success', () => {
    it('reports success, locks the way back, saves the answers and moves on to the email step', async () => {
        renderAt()
        await screen.findByRole('button', { name: 'Create passkey' })
        await tap()
        await waitFor(() => expect(cursor()).toBe('notification-email'))

        expect(events(ANALYTICS_EVENTS.SIGNUP_PASSKEY_SUCCEEDED)).toEqual([
            [ANALYTICS_EVENTS.SIGNUP_PASSKEY_SUCCEEDED, expect.objectContaining({ device_type: 'android' })],
        ])
        await waitFor(() =>
            expect(savedFor('new-user')).toMatchObject({
                residenceCountry: 'AR',
                nationality: 'BR',
                signupPreferences: { fundingChannel: 'arsBank', paymentChannel: 'qr' },
            })
        )

        await act(async () => probe.flow.handleBack())
        expect(cursor()).toBe('notification-email')
        for (const target of ['passkey', 'invite', 'signup', 'payment-plan', 'residence', 'landing']) {
            await act(async () => {
                probe.flow.setScreenId(target as ScreenId)
            })
            expect(cursor()).toBe('notification-email')
        }
        expect(mockHandleRegister).toHaveBeenCalledTimes(1)
    })

    it('reports a failed ceremony from this screen and stays', async () => {
        mockHandleRegister.mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }))
        renderAt()
        await screen.findByRole('button', { name: 'Create passkey' })
        await tap()
        await waitFor(() =>
            expect(events(ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED)).toEqual([
                [ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED, expect.objectContaining({ error_name: 'NotAllowedError' })],
            ])
        )
        expect(cursor()).toBe('passkey')
        expect(events(ANALYTICS_EVENTS.SIGNUP_PASSKEY_SUCCEEDED)).toEqual([])
        expect(mockUpdateUser).not.toHaveBeenCalled()
    })
})

describe('the stored inviter is accepted only once the account exists (failure 10)', () => {
    it('accepts the inviter chosen on Invite after registration, once', async () => {
        renderAt('invite')
        await selectInviter('alice')
        expect(mockAcceptInvite).not.toHaveBeenCalled()
        await tap()
        await waitFor(() => expect(cursor()).toBe('notification-email'))
        await waitFor(() => expect(mockAcceptInvite).toHaveBeenCalledTimes(1))
        expect(mockAcceptInvite).toHaveBeenCalledWith('alice', EInviteType.DIRECT)
        await waitFor(() => expect(probe.context.inviterAccepted).toBe(true))
    })

    it('accepts nobody when the person skipped after choosing an inviter', async () => {
        renderAt('invite')
        await selectInviter('alice')
        await act(async () => probe.flow.handleBack())
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
        })
        await waitFor(() => expect(cursor()).toBe('passkey'))
        await tap()
        await waitFor(() => expect(cursor()).toBe('notification-email'))
        await act(async () => {})
        expect(mockAcceptInvite).not.toHaveBeenCalled()
        expect(probe.context.inviterAccepted).toBe(false)
    })

    it('accepts only the last inviter chosen', async () => {
        renderAt('invite')
        await selectInviter('alice')
        await act(async () => probe.flow.handleBack())
        await selectInviter('carol')
        await tap()
        await waitFor(() => expect(mockAcceptInvite).toHaveBeenCalledTimes(1))
        expect(mockAcceptInvite).toHaveBeenCalledWith('carol', EInviteType.DIRECT)
    })
})

describe('saving the answers fails after registration (failure 5)', () => {
    type Flush = (userId: string) => Promise<unknown> | unknown
    const loadFlush = () =>
        (jest.requireActual('@/features/setup/saveSignupAnswers') as { flushPendingSignupAnswers?: Flush })
            .flushPendingSignupAnswers

    it('keeps a pending save for that account and retries it until acknowledged, never registering again', async () => {
        mockUpdateUser.mockResolvedValue({ error: 'Service unavailable' })
        renderAt()
        await screen.findByRole('button', { name: 'Create passkey' })
        await tap()
        await waitFor(() => expect(cursor()).toBe('notification-email'))
        await waitFor(() => expect(mockUpdateUser).toHaveBeenCalled())

        const flush = loadFlush()
        expect(flush).toEqual(expect.any(Function))
        // an app restart: in-memory queues are gone, the device still holds the pending save
        __resetSignupSavesForTests()
        mockUpdateUser.mockClear()
        mockUpdateUser.mockResolvedValue({ data: {} })

        await act(async () => {
            await flush!('someone-else')
        })
        expect(savedFor('new-user')).toEqual({})

        await act(async () => {
            await flush!('new-user')
        })
        expect(savedFor('new-user')).toMatchObject({
            residenceCountry: 'AR',
            nationality: 'BR',
            signupPreferences: { fundingChannel: 'arsBank', paymentChannel: 'qr' },
        })

        mockUpdateUser.mockClear()
        await act(async () => {
            await flush!('new-user')
        })
        expect(mockUpdateUser).not.toHaveBeenCalled()
        expect(mockHandleRegister).toHaveBeenCalledTimes(1)
    })
})

describe('accepting the inviter fails after registration (failure 6)', () => {
    it('moves on, keeps the inviter for its own retry and never marks it accepted', async () => {
        mockAcceptInvite.mockResolvedValue(RETRYABLE)
        renderAt('invite')
        await selectInviter('alice')
        await tap()
        await waitFor(() => expect(cursor()).toBe('notification-email'))
        await waitFor(() => expect(mockAcceptInvite).toHaveBeenCalled())
        await act(async () => {})
        expect(probe.context.inviterAccepted).toBe(false)
        expect(readInviteCode()).toBe('alice')
        // the answers are saved independently of the inviter
        await waitFor(() => expect(savedFor('new-user')).toMatchObject({ residenceCountry: 'AR' }))
        expect(mockHandleRegister).toHaveBeenCalledTimes(1)
    })

    it('does not mark the inviter accepted while the acceptance is still pending', async () => {
        mockAcceptInvite.mockImplementation(() => new Promise(() => {}))
        // registration itself completes; only the acceptance hangs
        mockHandleRegister.mockImplementation(async () => {
            mockSession.set({ user: NEW_USER })
            void settlePendingInviteAttribution(NEW_USER.user.userId, 'registration')
            mockSession.set({ address: '0xnew' })
        })
        renderAt('invite')
        await selectInviter('alice')
        await tap()
        await waitFor(() => expect(cursor()).toBe('notification-email'))
        expect(probe.context.inviterAccepted).toBe(false)
    })
})

describe('control analytics', () => {
    it('attributes the passkey screen’s controls to screen_id passkey', async () => {
        renderAt()
        await screen.findByRole('button', { name: 'Create passkey' })
        fireEvent.click(screen.getByRole('button', { name: /learn more about passkeys/i }))
        expect(signupControls(posthog.capture as jest.Mock)).toContain('passkeys_doc:open')
        const screens = (posthog.capture as jest.Mock).mock.calls
            .filter(([event]) => event === ANALYTICS_EVENTS.CONTROL_USED)
            .map(([, props]) => props.screen_id)
        expect(new Set(screens)).toEqual(new Set(['passkey']))
    })
})

it('the passkey step exists in the registry', () => {
    expect(setupSteps.some((step) => step.screenId === PASSKEY)).toBe(true)
})
