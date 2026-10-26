import React, { StrictMode, useState } from 'react'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { JourneyState } from '../types'

const mockCapture = jest.fn()
jest.mock('../serverAttention', () => ({
    ...jest.requireActual('../serverAttention'),
    useServerAttention: () => undefined,
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
    capture: (...args: unknown[]) => mockCapture(...args),
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))
jest.mock('@/utils/overlay-visibility', () => ({
    ...jest.requireActual('@/utils/overlay-visibility'),
    useAnyOverlayOpen: () => false,
}))

let mockPathname = '/withdraw'
jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('@/utils/demo', () => ({ ...jest.requireActual('@/utils/demo'), isDemoMode: () => false }))
jest.mock('@/features/kill-switches/useKillSwitches', () => {
    const { DEFAULT_KILL_SWITCHES } = jest.requireActual('@/features/kill-switches/kill-switches.consts')
    const fullMaintenance = { ...DEFAULT_KILL_SWITCHES, enableFullMaintenance: true }
    return { useKillSwitches: () => fullMaintenance }
})

let mockState: JourneyState
jest.mock('../journeyState', () => ({ ...jest.requireActual('../journeyState'), useJourneyState: () => mockState }))
jest.mock('../surfaces', () => ({ INTERRUPT_SURFACES: {} }))
jest.mock('../zoneSurfaces', () => ({ ZONE_SURFACES: {} }))

interface InlineStubProps {
    askId: string
    slot: string
    context?: Record<string, unknown>
}
function mockInlineSurface({ askId, slot, context }: InlineStubProps) {
    return (
        <div data-testid={`inline-${askId}`} data-slot={slot}>
            {String(context?.advisoryDeadline ?? 'no deadline')}
        </div>
    )
}
jest.mock('../inlineSurfaces', () => ({
    INLINE_SURFACES: {
        'verification-deadline': (props: InlineStubProps) => mockInlineSurface(props),
        'cap-nudge': (props: InlineStubProps) => mockInlineSurface(props),
    },
}))
jest.mock('../bannerSurfaces', () => ({
    BANNER_SURFACES: {
        maintenance: ({ askId, variant }: { askId: string; variant: string }) => (
            <div data-testid={`banner-${askId}`} data-variant={variant}>
                {require('@/i18n/app/messages/en.json').global.maintenanceBanner}
            </div>
        ),
    },
}))

interface CtaStub {
    text: React.ReactNode
    disabled?: boolean
    onClick?: () => void
}
interface ModalStubProps {
    visible: boolean
    title: React.ReactNode
    description?: React.ReactNode
    content?: React.ReactNode
    checkbox?: { text: React.ReactNode; checked: boolean; onChange: (checked: boolean) => void }
    ctas?: CtaStub[]
    tertiaryCta?: CtaStub
    preventClose?: boolean
    hideModalCloseButton?: boolean
    onClose: () => void
    'data-testid'?: string
}
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: (props: ModalStubProps) =>
        !props.visible ? null : (
            <div data-testid={props['data-testid']}>
                <h2>{props.title}</h2>
                <div>{props.description}</div>
                <div>{props.content}</div>
                {props.checkbox && (
                    <label>
                        <input
                            type="checkbox"
                            checked={props.checkbox.checked}
                            onChange={(event) => props.checkbox?.onChange(event.target.checked)}
                        />
                        {props.checkbox.text}
                    </label>
                )}
                {props.ctas?.map((cta, index) => (
                    <button key={index} disabled={cta.disabled} onClick={cta.onClick}>
                        {cta.text}
                    </button>
                ))}
                {props.tertiaryCta && (
                    <button disabled={props.tertiaryCta.disabled} onClick={props.tertiaryCta.onClick}>
                        {props.tertiaryCta.text}
                    </button>
                )}
                {!props.hideModalCloseButton && (
                    <button aria-label="Close" onClick={() => !props.preventClose && props.onClose()}>
                        Close
                    </button>
                )}
            </div>
        ),
}))

let mockDrawerProps: { onOpenChange?: (open: boolean) => void; dismissible?: boolean } = {}
jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({
        open,
        onOpenChange,
        dismissible,
        children,
    }: {
        open: boolean
        onOpenChange?: (open: boolean) => void
        dismissible?: boolean
        children: React.ReactNode
    }) => {
        mockDrawerProps = { onOpenChange, dismissible }
        return open ? <div data-testid="drawer-root">{children}</div> : null
    },
    DrawerContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    DrawerHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
    DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DrawerDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DrawerClose: ({ children }: { children?: React.ReactNode }) => (
        <button aria-label="Close">{children ?? 'Close'}</button>
    ),
}))
jest.mock('@/components/0_Bruddle/IconBubble', () => ({ IconBubble: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: ({ name }: { name: string }) => <span data-icon={name} /> }))

import { AttentionProvider, resetAttentionSessionForTests, useAttentionOptional } from '../AttentionProvider'
import { DEFAULT_KILL_SWITCHES } from '@/features/kill-switches/kill-switches.consts'
import { selectMaintenance } from '../maintenance'

// Export-shape tolerance follows the existing arbiter tests; the contracts are tested through public components.
const shellModule = require('../AskShell')
const AskShell = shellModule.AskShell ?? shellModule.default
const slotModule = require('../AttentionSlot')
const AttentionSlot = slotModule.AttentionSlot ?? slotModule.default
const bannerModule = require('../AttentionBanner')
const AttentionBanner = bannerModule.AttentionBanner ?? bannerModule.default

const DEADLINE = '2026-11-01T00:00:00.000Z'
const state = (overrides: Record<string, unknown> = {}): JourneyState =>
    ({
        now: Date.now(),
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
        card: { loaded: true, needsSetup: false, activeCardId: null },
        postAuthRedirect: false,
        postAuthRedirectDestination: null,
        balance: { loaded: true, usd: 0 },
        migration: { on: false },
        push: { ready: true, unanswered: false, promptedThisSession: false, notEnabled: false },
        showEarlyUserModal: false,
        activated: true,
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
        arrival: 'none',
        capNudge: null,
        maintenance: 'none',
        ...overrides,
    }) as unknown as JourneyState

let latest: ReturnType<typeof useAttentionOptional>
function Probe() {
    latest = useAttentionOptional()
    return null
}
const providerTree = (children: React.ReactNode) => (
    <AttentionProvider>
        <Probe />
        {children}
    </AttentionProvider>
)
const slots = () => (latest?.session as unknown as { slots?: InlineStubProps[] } | undefined)?.slots

beforeEach(() => {
    window.localStorage.clear()
    jest.clearAllMocks()
    resetAttentionSessionForTests()
    mockState = state()
    mockPathname = '/withdraw'
    mockDrawerProps = {}
    latest = undefined
})
afterEach(() => {
    cleanup()
})

function ConsentShell({
    presentation,
    onAccept,
    onLater,
    onClose,
}: {
    presentation: 'modal' | 'drawer'
    onAccept: () => void
    onLater: () => void
    onClose: () => void
}) {
    const [checked, setChecked] = useState(false)
    return (
        <AskShell
            presentation={presentation}
            title="Updated terms"
            description="Please review the changes"
            body={<a href="https://example.com/terms">Read the documents</a>}
            checkbox={{ text: 'I agree', checked, onChange: setChecked }}
            ctas={[
                { text: 'Accept', disabled: !checked, onClick: onAccept },
                { text: 'Help', onClick: onLater },
            ]}
            tertiaryCta={{ text: 'Not now', onClick: onLater }}
            onClose={onClose}
            testId="ask-shell"
        />
    )
}

describe('AskShell', () => {
    test.each(['modal', 'drawer'] as const)('%s renders the same content, checkbox and CTAs', (presentation) => {
        const onAccept = jest.fn()
        const onLater = jest.fn()
        renderWithIntl(
            <ConsentShell presentation={presentation} onAccept={onAccept} onLater={onLater} onClose={jest.fn()} />
        )
        // "One component that renders an interrupt's content as a modal or a drawer"
        expect(screen.getByRole('heading', { name: 'Updated terms' })).toBeInTheDocument()
        // "title + description head, then body, then checkbox ... then CTAs ... then the tertiary"
        expect(screen.getByText('Please review the changes')).toBeInTheDocument()
        // "free content under the description (links, callouts, a slide-to-confirm, a share button)"
        expect(screen.getByRole('link', { name: 'Read the documents' })).toHaveAttribute(
            'href',
            'https://example.com/terms'
        )
        // "then checkbox (@/components/0_Bruddle/Checkbox)"
        expect(screen.getByRole('checkbox', { name: 'I agree' })).not.toBeChecked()
        // "then CTAs as @/components/0_Bruddle/Button"
        expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
        // "then CTAs as @/components/0_Bruddle/Button"
        expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument()
        // "then the tertiary as @/components/0_Bruddle/LinkButton"
        expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
        // "Both shells set data-testid={testId} on their root content when given."
        expect(screen.getByTestId('ask-shell')).toContainElement(screen.getByRole('heading', { name: 'Updated terms' }))
        fireEvent.click(screen.getByRole('checkbox', { name: 'I agree' }))
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
        // "same props as ActionModal's ctas: text, onClick ... disabled"
        expect(onAccept).toHaveBeenCalledTimes(1)
        fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
        // "then the tertiary as @/components/0_Bruddle/LinkButton"
        expect(onLater).toHaveBeenCalledTimes(1)
    })

    test('drawer Accept stays disabled until its checkbox is ticked', () => {
        const onAccept = jest.fn()
        renderWithIntl(
            <ConsentShell presentation="drawer" onAccept={onAccept} onLater={jest.fn()} onClose={jest.fn()} />
        )
        // "drawer renders the checkbox"; "same props as ActionModal's ctas ... disabled"
        expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
        // "same props as ActionModal's ctas ... disabled"
        expect(onAccept).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('checkbox', { name: 'I agree' }))
        // "then checkbox (@/components/0_Bruddle/Checkbox)"
        expect(screen.getByRole('checkbox', { name: 'I agree' })).toBeChecked()
        // "same props as ActionModal's ctas ... disabled"
        expect(screen.getByRole('button', { name: 'Accept' })).toBeEnabled()
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
        // "same props as ActionModal's ctas: text, onClick"
        expect(onAccept).toHaveBeenCalledTimes(1)
    })

    test('non-dismissible drawer has no close affordance and rejects onOpenChange(false)', () => {
        const onClose = jest.fn()
        renderWithIntl(
            <AskShell presentation="drawer" title="Back up your balance" dismissible={false} onClose={onClose} />
        )
        // "false: no X, no backdrop or swipe or Escape close, hardware back is a no-op"
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        // "drawer renders ... with dismissible"
        expect(mockDrawerProps.dismissible).toBe(false)
        // "onOpenChange(false) calls onClose only when dismissible."
        expect(mockDrawerProps.onOpenChange).toEqual(expect.any(Function))
        act(() => mockDrawerProps.onOpenChange?.(false))
        // "onOpenChange(false) calls onClose only when dismissible."
        expect(onClose).not.toHaveBeenCalled()
    })

    test('dismissible drawer forwards an attempted close', () => {
        const onClose = jest.fn()
        renderWithIntl(<AskShell presentation="drawer" title="Optional notice" onClose={onClose} />)
        act(() => mockDrawerProps.onOpenChange?.(false))
        // "onOpenChange(false) calls onClose only when dismissible."
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})

describe('AttentionSlot', () => {
    test('registers on mount and releases its hold on unmount', async () => {
        const view = renderWithIntl(
            providerTree(<AttentionSlot id="bank-transfer" context={{ advisoryDeadline: DEADLINE }} />)
        )
        await waitFor(() => {
            // "On mount it registers { id, context } in a module store"
            expect(slots()).toEqual([{ id: 'bank-transfer', context: { advisoryDeadline: DEADLINE } }])
        })
        view.rerender(providerTree(null))
        await waitFor(() => {
            // "slot unmounts (page navigates) ... hold released, notice gone"
            expect(slots()).toEqual([])
        })
        // "slot unmounts (page navigates) ... hold released, notice gone"
        expect(screen.queryByTestId('inline-verification-deadline')).not.toBeInTheDocument()
    })

    test('renders the inline surface only in the decided slot', async () => {
        mockState = state({ capNudge: { kind: 'verify' } })
        renderWithIntl(
            providerTree(
                <>
                    <section data-testid="bank">
                        <AttentionSlot id="bank-transfer" context={{ advisoryDeadline: DEADLINE }} />
                    </section>
                    <section data-testid="limits">
                        <AttentionSlot id="limits" />
                    </section>
                </>
            )
        )
        await waitFor(() => {
            // "It renders the inline surface for decision.inline only when decision.inline.slot === id"
            expect(within(screen.getByTestId('bank')).getByTestId('inline-verification-deadline')).toBeInTheDocument()
        })
        // "At most one inline notice per screen, across all mounted slots."
        expect(within(screen.getByTestId('limits')).queryByTestId('inline-cap-nudge')).not.toBeInTheDocument()
        // "Surface: VerificationDeadlineNotice ... reads context.advisoryDeadline"
        expect(screen.getByTestId('inline-verification-deadline')).toHaveTextContent(DEADLINE)
        // "It renders the inline surface for decision.inline only when decision.inline.slot === id"
        expect(screen.getByTestId('inline-verification-deadline')).toHaveAttribute('data-slot', 'bank-transfer')
    })

    test('only the first duplicate slot instance renders and release promotes the next', async () => {
        const tree = (first: boolean) =>
            providerTree(
                <>
                    {first && (
                        <section key="first" data-testid="first">
                            <AttentionSlot id="bank-transfer" context={{ advisoryDeadline: DEADLINE }} />
                        </section>
                    )}
                    <section key="second" data-testid="second">
                        <AttentionSlot id="bank-transfer" context={{ advisoryDeadline: '2026-12-01T00:00:00.000Z' }} />
                    </section>
                </>
            )
        const view = renderWithIntl(tree(true))
        await waitFor(() => {
            // "this instance is the first mounted instance of that slot id"
            expect(within(screen.getByTestId('first')).getByTestId('inline-verification-deadline')).toBeInTheDocument()
        })
        // "only the first instance renders"
        expect(
            within(screen.getByTestId('second')).queryByTestId('inline-verification-deadline')
        ).not.toBeInTheDocument()
        // "only the first instance renders"
        expect(screen.getAllByTestId('inline-verification-deadline')).toHaveLength(1)
        view.rerender(tree(false))
        await waitFor(() => {
            // "counted holds keyed by a per-instance symbol ... two instances of one slot are safe"
            expect(within(screen.getByTestId('second')).getByTestId('inline-verification-deadline')).toHaveTextContent(
                '2026-12-01T00:00:00.000Z'
            )
        })
    })

    test('StrictMode does not double-register or leak a released slot', async () => {
        const tree = (mounted: boolean) => (
            <StrictMode>
                {providerTree(
                    mounted ? <AttentionSlot id="bank-transfer" context={{ advisoryDeadline: DEADLINE }} /> : null
                )}
            </StrictMode>
        )
        const view = renderWithIntl(tree(true))
        await waitFor(() => {
            // "counted holds keyed by a per-instance symbol ... so StrictMode remounts ... are safe"
            expect(slots()).toEqual([{ id: 'bank-transfer', context: { advisoryDeadline: DEADLINE } }])
        })
        // "At most one inline notice per screen"
        expect(screen.getAllByTestId('inline-verification-deadline')).toHaveLength(1)
        view.rerender(tree(false))
        await waitFor(() => {
            // "slot unmounts (page navigates) ... hold released, notice gone"
            expect(slots()).toEqual([])
        })
    })

    test('a context change re-evaluates the slot without remounting', async () => {
        const view = renderWithIntl(
            providerTree(<AttentionSlot id="bank-transfer" context={{ advisoryDeadline: null }} />)
        )
        // "whose policy.slotWhen (if any) returns true for that slot's context"
        expect(screen.queryByTestId('inline-verification-deadline')).not.toBeInTheDocument()
        view.rerender(providerTree(<AttentionSlot id="bank-transfer" context={{ advisoryDeadline: DEADLINE }} />))
        await waitFor(() => {
            // "slot context changes (a new deadline) ... store emits, decide re-runs"
            expect(screen.getByTestId('inline-verification-deadline')).toHaveTextContent(DEADLINE)
        })
        view.rerender(providerTree(<AttentionSlot id="bank-transfer" context={{ advisoryDeadline: 'garbage' }} />))
        await waitFor(() => {
            // "typeof ctx?.advisoryDeadline === 'string' && !Number.isNaN(Date.parse(ctx.advisoryDeadline))"
            expect(screen.queryByTestId('inline-verification-deadline')).not.toBeInTheDocument()
        })
    })

    test('without a provider a slot renders nothing', () => {
        const view = renderWithIntl(<AttentionSlot id="bank-transfer" context={{ advisoryDeadline: DEADLINE }} />)
        // "If a slot renders with no provider ... it renders nothing."
        expect(view.container).toBeEmptyDOMElement()
    })
})

describe('AttentionBanner', () => {
    test('without a provider it renders the maintenance callout selected for the route', () => {
        // "AttentionBanner with no provider evaluates selectMaintenance itself and renders the same callout."
        expect(
            selectMaintenance({
                pathname: mockPathname,
                config: { ...DEFAULT_KILL_SWITCHES, enableFullMaintenance: true },
                demo: false,
            })
        ).toBe('full')
        renderWithIntl(<AttentionBanner variant="global" />)
        // "otherwise the one-liner"
        expect(screen.getByText(en.global.maintenanceBanner)).toBeInTheDocument()
    })

    test.each(['/home', '/home/x'])('without a provider it renders nothing on %s', (pathname) => {
        mockPathname = pathname
        const view = renderWithIntl(<AttentionBanner variant="feature" />)
        // "'/home' and '/home/*' → none"
        expect(view.container).toBeEmptyDOMElement()
    })

    test('with a provider it renders decision.banner’s registered surface and variant', async () => {
        mockState = state({ maintenance: 'scoped' })
        renderWithIntl(providerTree(<AttentionBanner variant="feature" />))
        await waitFor(() => {
            // "renders the banner surface for decision.banner"
            expect((latest?.decision as unknown as { banner?: string })?.banner).toBe('maintenance')
        })
        // "renders the banner surface for decision.banner (BANNER_SURFACES ... BannerSurfaceProps)"
        expect(screen.getByTestId('banner-maintenance')).toHaveAttribute('data-variant', 'feature')
    })

    test('a provider with no banner pick suppresses the provider-less fallback', () => {
        mockState = state({ maintenance: 'none' })
        const view = renderWithIntl(providerTree(<AttentionBanner variant="global" />))
        // "renders the banner surface for decision.banner"
        expect(view.container).toBeEmptyDOMElement()
    })
})
