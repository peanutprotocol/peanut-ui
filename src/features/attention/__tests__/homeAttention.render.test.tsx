/** Phase 8 §2: one Home frame; a more critical card replaces the to-do list (Slava, 2026-10-12). */
import React from 'react'
import { act, cleanup, screen, within } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { checklistProgress, type OnboardingState } from '@/utils/activation-step.utils'
import type { JourneyState, ZoneSurfaceProps } from '../types'

let mockState: JourneyState
let mockOnboarding: OnboardingState
jest.mock('../journeyState', () => ({ useJourneyState: () => mockState }))
jest.mock('@/hooks/useActivationStatus', () => ({
    useActivationStatus: () => ({ onboarding: mockOnboarding, isLoading: false, isActivated: false }),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn() },
    capture: jest.fn(),
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))
jest.mock('@/utils/overlay-visibility', () => ({
    ...jest.requireActual('@/utils/overlay-visibility'),
    useAnyOverlayOpen: () => false,
}))

function mockZoneSurface({ askId, onActed }: ZoneSurfaceProps) {
    return (
        <div data-testid={`zone-${askId}`}>
            <button onClick={onActed}>Continue {askId}</button>
        </div>
    )
}
jest.mock('../zoneSurfaces', () => ({
    ZONE_SURFACES: {
        checklist: (props: ZoneSurfaceProps) => mockZoneSurface(props),
        'blocked-card': (props: ZoneSurfaceProps) => mockZoneSurface(props),
        'verification-due': (props: ZoneSurfaceProps) => mockZoneSurface(props),
        invite: (props: ZoneSurfaceProps) => mockZoneSurface(props),
    },
}))

import { AttentionProvider, resetAttentionSessionForTests } from '../AttentionProvider'
import { AttentionZone, HomeAttention } from '../AttentionZone'
import { updateUserPreferences } from '@/utils/general.utils'

const onboarding = (patch: Partial<OnboardingState> = {}): OnboardingState => ({
    verify: 'done',
    addMoneyDone: true,
    firstPaymentDone: false,
    firstPaymentRoute: 'card_qr',
    step: 'first_payment',
    ...patch,
})

const state = (patch: Partial<JourneyState> = {}): JourneyState => ({
    capNudge: null,
    maintenance: 'none',
    now: Date.now(),
    userId: 'user-a',
    userLoaded: true,
    isNative: true,
    route: 'home',
    consent: { status: 'clear', versions: [], documents: [] },
    identity: {
        status: 'verified',
        isVerified: true,
        needsAction: false,
        isTerminalFailure: false,
        isRegionRestricted: false,
    },
    onboarding: mockOnboarding,
    blockedCardId: null,
    dueTasks: 0,
    card: { loaded: true, needsSetup: false, activeCardId: null },
    postAuthRedirect: false,
    postAuthRedirectDestination: null,
    balance: { loaded: true, usd: 0 },
    migration: { on: false },
    push: { ready: true, unanswered: false, promptedThisSession: false, notEnabled: false },
    showEarlyUserModal: false,
    activated: false,
    geoCountry: 'US',
    invitesSent: 1,
    hasSupportSurvivorBadge: true,
    cardOffer: { loaded: true, geoProhibited: false, hasCardRelationship: true, promotionDisabled: false },
    qr: { canPayNow: false, hasMadeQrPayment: false, verifyOpensQr: false },
    documentSlideKey: null,
    flags: { userInterview: false },
    depositAccounts: { enabled: false, loaded: true, claimable: 0, active: 0 },
    lastSpendAt: null,
    hasReceivedRequestPayment: true,
    firstPeerPaymentAt: '2026-09-01T00:00:00.000Z',
    passkeyCount: null,
    hasEmail: true,
    hasFullName: true,
    rewardsPendingUsd: 0,
    serverLedger: undefined,
    ...patch,
})

async function mount() {
    const view = renderWithIntl(
        <AttentionProvider>
            <HomeAttention />
        </AttentionProvider>
    )
    await act(async () => {})
    return view
}

beforeEach(() => {
    window.localStorage.clear()
    resetAttentionSessionForTests()
    updateUserPreferences('user-a', { sessionCount: 3 })
    mockOnboarding = onboarding()
    mockState = state()
})

afterEach(() => {
    cleanup()
    resetAttentionSessionForTests()
})

describe('Phase 8: HomeAttention frame and summary', () => {
    test('AttentionZone remains an alias of HomeAttention', () => {
        expect(AttentionZone).toBe(HomeAttention)
    })

    test('the checklist renders inside one labelled section without a duplicate summary', async () => {
        await mount()
        const frame = screen.getByRole('region', { name: 'Next steps' })
        expect(frame.tagName).toBe('SECTION')
        expect(frame).toHaveAttribute('data-testid', 'home-attention')
        expect(frame).toHaveClass('flex', 'flex-col', 'gap-2')
        expect(screen.getAllByTestId('home-attention')).toHaveLength(1)
        expect(within(frame).getByTestId('zone-checklist')).toBeInTheDocument()
        expect(screen.queryByTestId('todo-summary')).not.toBeInTheDocument()
    })

    test.each([
        ['checklist', null],
        ['blocked-card', 'blocked-card:verification-issue:provider_rejected'],
    ])(
        'a T1 pick replaces %s: only the critical card, one CTA, no list or progress',
        async (_anchor, blockedCardId) => {
            mockState = state({ dueTasks: 1, blockedCardId })
            await mount()
            const frame = screen.getByTestId('home-attention')
            expect(within(frame).getByTestId('zone-verification-due')).toBeInTheDocument()
            expect(within(frame).getAllByRole('button')).toHaveLength(1)
            expect(within(frame).queryByTestId('zone-checklist')).not.toBeInTheDocument()
            expect(within(frame).queryByTestId('zone-blocked-card')).not.toBeInTheDocument()
            expect(screen.queryByTestId('todo-summary')).not.toBeInTheDocument()
        }
    )

    test('a critical card without an underlay renders no summary', async () => {
        mockOnboarding = onboarding({ firstPaymentDone: true, step: 'completed' })
        mockState = state({ activated: true, dueTasks: 1 })
        await mount()
        expect(screen.getByTestId('zone-verification-due')).toBeInTheDocument()
        expect(screen.queryByTestId('todo-summary')).not.toBeInTheDocument()
    })

    test('an activated-user card without an underlay renders no summary', async () => {
        mockOnboarding = onboarding({ firstPaymentDone: true, step: 'completed' })
        mockState = state({ activated: true, invitesSent: 0 })
        await mount()
        expect(screen.getByTestId('zone-invite')).toBeInTheDocument()
        expect(screen.queryByTestId('todo-summary')).not.toBeInTheDocument()
    })
})

describe('Phase 8: checklistProgress pure counter', () => {
    test('create account is always done, even before verification and funding', () => {
        expect(checklistProgress(onboarding({ verify: 'todo', addMoneyDone: false, step: 'verify' }))).toEqual({
            done: 1,
            total: 4,
        })
    })

    test.each<OnboardingState['verify']>(['todo', 'in_review', 'action_required', 'failed'])(
        'verification %s is an open row',
        (verify) => {
            expect(checklistProgress(onboarding({ verify, addMoneyDone: false }))).toEqual({ done: 1, total: 4 })
        }
    )

    test('only verify done and addMoneyDone complete their respective rows', () => {
        expect(checklistProgress(onboarding({ addMoneyDone: false }))).toEqual({ done: 2, total: 4 })
        expect(checklistProgress(onboarding())).toEqual({ done: 3, total: 4 })
    })

    test.each<OnboardingState['firstPaymentRoute']>(['card_qr', 'card', 'qr'])(
        '%s includes a first-payment row completed only by firstPaymentDone',
        (firstPaymentRoute) => {
            expect(checklistProgress(onboarding({ firstPaymentRoute }))).toEqual({ done: 3, total: 4 })
            expect(checklistProgress(onboarding({ firstPaymentRoute, firstPaymentDone: true }))).toEqual({
                done: 4,
                total: 4,
            })
        }
    )

    test('none omits the payment row even if firstPaymentDone is true', () => {
        expect(checklistProgress(onboarding({ firstPaymentRoute: 'none' }))).toEqual({ done: 3, total: 3 })
        expect(checklistProgress(onboarding({ firstPaymentRoute: 'none', firstPaymentDone: true }))).toEqual({
            done: 3,
            total: 3,
        })
    })

    test('pending keeps an open payment row', () => {
        expect(checklistProgress(onboarding({ firstPaymentRoute: 'pending' }))).toEqual({ done: 3, total: 4 })
    })

    test('counts depend on row facts, not the cached onboarding step', () => {
        expect(checklistProgress(onboarding({ verify: 'todo', addMoneyDone: false, step: 'completed' }))).toEqual({
            done: 1,
            total: 4,
        })
        expect(checklistProgress(onboarding({ firstPaymentDone: true, step: 'verify' }))).toEqual({ done: 4, total: 4 })
    })
})
