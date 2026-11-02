/**
 * The two card setup prompts through the real manager, provider and ledger:
 * `finish-card-setup` (EnableAutoBalanceBanner, the existing permission) and
 * `finish-card-funding` (FundingSetupPrompt, managed funding). Only their
 * hooks are stubbed.
 */
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import type { AskId, AskSurfaceProps, JourneyState } from '../types'

jest.mock('../serverAttention', () => ({
    ...jest.requireActual('../serverAttention'),
    useServerAttention: () => undefined,
}))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))
jest.mock('../ledgerSync', () => ({ scheduleLedgerSync: jest.fn() }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/utils/overlay-visibility', () => ({
    ...jest.requireActual('@/utils/overlay-visibility'),
    useAnyOverlayOpen: () => false,
}))

let mockState: JourneyState
jest.mock('../journeyState', () => ({
    ...jest.requireActual('../journeyState'),
    useJourneyState: () => mockState,
}))

let mockSurfaces: Partial<Record<AskId, React.ComponentType<AskSurfaceProps>>> = {}
jest.mock('../surfaces', () => ({
    get INTERRUPT_SURFACES() {
        return mockSurfaces
    },
}))

jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: (props: {
        visible: boolean
        content?: React.ReactNode
        ctas?: { text: string; onClick: () => void; disabled?: boolean }[]
        tertiaryCta?: { text: string; onClick?: () => void }
    }) =>
        props.visible ? (
            <div data-testid="modal">
                {props.content}
                {props.ctas?.map((c) => (
                    <button key={c.text} onClick={c.onClick} disabled={c.disabled}>
                        {c.text}
                    </button>
                ))}
                {props.tertiaryCta && <button onClick={props.tertiaryCta.onClick}>{props.tertiaryCta.text}</button>}
            </div>
        ) : null,
}))
jest.mock('@/components/Card/CardFundingConsent', () => ({
    __esModule: true,
    default: ({ onAuthorizationChange }: { onAuthorizationChange: (v: boolean) => void }) => (
        <input type="checkbox" data-testid="card-funding-consent" onChange={() => onAuthorizationChange(true)} />
    ),
}))

type MockCard = { id: string; status: string; hasWithdrawApproval: boolean }
let mockCards: MockCard[] = []
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({
        overview: { cards: mockCards, status: { contractAddress: '0xabc', coordinatorAddress: '0xdef' } },
    }),
}))
let mockAccess: { fundingMode: 'legacy' | 'managed'; enrollmentAllowed: boolean }
jest.mock('@/hooks/useCardFundingAccess', () => {
    const { fundingSetupPath } = jest.requireActual('@/utils/rain-funding.utils')
    return { useCardFundingAccess: () => ({ access: mockAccess, setupPath: fundingSetupPath(mockAccess) }) }
})
const mockSessionGrant = jest.fn()
let mockSessionError: { kind: string } | null = null
jest.mock('@/hooks/wallet/useGrantSessionKey', () => ({
    useGrantSessionKey: () => ({ grant: mockSessionGrant, isGranting: false, lastError: mockSessionError }),
}))
let mockFundingError: { kind: string } | null = null
jest.mock('@/hooks/wallet/useRainFunding', () => ({
    useRainFunding: () => ({
        funding: { permission: { authorizationText: 'I authorize' }, management: { status: 'required' } },
        status: 'required',
        needsGrant: true,
        isMigration: false,
        isPending: false,
        isWithdrawalInFlight: false,
        grant: jest.fn(),
        recheck: jest.fn(),
        isSubmitting: false,
        step: 'idle',
        lastError: mockFundingError,
        owesReturn: false,
        returnError: null,
        continueSetup: jest.fn(),
    }),
}))

import { AttentionProvider, resetAttentionSessionForTests, useAttentionOptional } from '../AttentionProvider'
import { AttentionInterrupt } from '../AttentionInterrupt'
import { readLedger } from '../ledger'
import { resetFundingPromptHoldsForTests } from '../cardFunding'
import { updateUserPreferences } from '@/utils/general.utils'
import EnableAutoBalanceBanner from '@/components/Home/EnableAutoBalanceBanner'
import FundingSetupPrompt from '@/components/Home/FundingSetupPrompt'

const NOW = Date.parse('2026-11-02T12:00:00Z')
const HOUR_MS = 60 * 60 * 1000

const state = (card: Partial<JourneyState['card']>): JourneyState =>
    ({
        capNudge: null,
        maintenance: 'none',
        now: NOW,
        userId: 'user-a',
        userLoaded: true,
        isNative: true,
        route: 'home',
        consent: { status: 'clear', versions: [], documents: [] },
        identity: {
            status: 'approved',
            isVerified: true,
            needsAction: false,
            isTerminalFailure: false,
            isRegionRestricted: false,
        },
        onboarding: {
            verify: 'done',
            addMoneyDone: true,
            firstPaymentDone: true,
            firstPaymentRoute: 'card_qr',
            step: 'completed',
        },
        blockedCardId: null,
        dueTasks: 0,
        card: {
            loaded: true,
            needsSetup: false,
            activeCardId: 'card-a',
            setupPath: 'none',
            needsFunding: false,
            ...card,
        },
        postAuthRedirect: false,
        postAuthRedirectDestination: null,
        balance: { loaded: true, usd: 0 },
        migration: { on: false },
        push: { ready: true, unanswered: false, promptedThisSession: false, notEnabled: false },
        showEarlyUserModal: false,
        activated: true,
        geoCountry: null,
        invitesSent: 3,
        hasSupportSurvivorBadge: true,
        cardOffer: { loaded: true, geoProhibited: false, hasCardRelationship: true, promotionDisabled: false },
        qr: { canPayNow: false, hasMadeQrPayment: true, verifyOpensQr: false },
        documentSlideKey: null,
        flags: { userInterview: false },
        depositAccounts: { enabled: false, loaded: true, claimable: 0, active: 0 },
        lastSpendAt: null,
        hasReceivedRequestPayment: true,
        firstPeerPaymentAt: '2026-09-01T00:00:00.000Z',
        passkeyCount: 2,
        hasEmail: true,
        hasFullName: true,
        rewardsPendingUsd: 0,
    }) as unknown as JourneyState

let latest: ReturnType<typeof useAttentionOptional>
function Probe() {
    latest = useAttentionOptional()
    return null
}

const Tree = () => (
    <AttentionProvider>
        <Probe />
        <AttentionInterrupt />
    </AttentionProvider>
)

async function mount() {
    const view = render(<Tree />)
    await act(async () => {})
    return view
}

async function click(text: string) {
    await act(async () => {
        screen.getByText(text).click()
    })
}

beforeEach(() => {
    window.localStorage.clear()
    resetAttentionSessionForTests()
    resetFundingPromptHoldsForTests()
    updateUserPreferences('user-a', { sessionCount: 3 })
    mockSurfaces = { 'finish-card-setup': EnableAutoBalanceBanner, 'finish-card-funding': FundingSetupPrompt }
    mockCards = [{ id: 'card-a', status: 'ACTIVE', hasWithdrawApproval: false }]
    mockSessionGrant.mockReset()
    mockSessionError = null
    mockFundingError = null
})

describe('finish-card-funding: dev FundingSetupPrompt through the manager', () => {
    beforeEach(() => {
        mockAccess = { fundingMode: 'managed', enrollmentAllowed: false }
        mockState = state({ needsSetup: true, setupPath: 'managed', needsFunding: true })
    })

    test('opens as the one interrupt with the consent checkbox; the legacy prompt stays out', async () => {
        await mount()
        expect(latest?.decision.interrupt).toBe('finish-card-funding')
        expect(screen.getAllByTestId('modal')).toHaveLength(1)
        expect(screen.getByTestId('card-funding-consent')).toBeInTheDocument()
        expect(latest?.decision.trace.verdicts['finish-card-setup']).toBe('ineligible')
    })

    test('"Skip for now" after a failure snoozes it for an hour for this card', async () => {
        mockFundingError = { kind: 'user-cancelled' }
        await mount()
        const before = Date.now()
        await click('skipForNow')
        const entry = readLedger('user-a')['finish-card-funding']
        expect(entry?.version).toBe('card-a')
        expect(Math.abs(Date.parse(entry!.snoozedUntil!) - (before + HOUR_MS))).toBeLessThanOrEqual(60_000)
        expect(entry?.dismissedAt).toBeUndefined()
        expect(latest?.decision.interrupt).toBeNull()
    })

    test('waits behind the updated terms', async () => {
        mockState = {
            ...state({ needsSetup: true, setupPath: 'managed', needsFunding: true }),
            consent: {
                status: 'needed',
                versions: ['2026-11-01'],
                documents: [{ slug: 'terms', currentVersion: '2026-11-01' }],
            },
        }
        mockSurfaces = { ...mockSurfaces, 'legal-reconsent': () => <div data-testid="terms" /> }
        await mount()
        expect(latest?.decision.interrupt).toBe('legal-reconsent')
        expect(screen.queryByTestId('card-funding-consent')).not.toBeInTheDocument()
    })
})

test('nothing mounts FundingSetupPrompt directly: it opens only as the manager ask', () => {
    const root = path.join(process.cwd(), 'src')
    const offenders: string[] = []
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(full)
            } else if (/\.tsx?$/.test(entry.name) && fs.readFileSync(full, 'utf8').includes('<FundingSetupPrompt')) {
                offenders.push(path.relative(root, full))
            }
        }
    }
    walk(root)
    expect(offenders).toEqual([])
})
