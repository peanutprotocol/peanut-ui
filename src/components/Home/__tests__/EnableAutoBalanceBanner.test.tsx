/**
 * EnableAutoBalanceBanner — escape-hatch + duplicate-card regressions
 *
 * The modal is preventClose + hideModalCloseButton. Two ways it trapped users:
 *
 * 1. `void grant()` discarded the result, so a cancelled/failed passkey left
 *    the user with a button that appeared to do nothing → error surfaces +
 *    "Skip for now" escape once a grant has failed.
 *
 * 2. 2026-07-02 duplicate-card incident: the modal keyed off `cards[0]`
 *    (newest) while the backend stored the grant on a different card — every
 *    tap "succeeded" and the modal never dismissed, and with no error the
 *    escape never rendered. Regressions below pin (a) findActiveCard-based
 *    selection (a CANCELED newest row must not drive the modal) and (b) the
 *    stuck-after-success escape + Sentry/console signal.
 *
 * It is the prompt for an account on the existing card permission that
 * managed funding is not open to (the server's decision). Every other
 * decision, and an unknown one, shows nothing here.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })
import type { GrantSessionKeyError } from '@/hooks/wallet/useGrantSessionKey'

let mockKernelReady = true
jest.mock('@/hooks/useZeroDevFlow', () => ({ useZeroDevFlow: () => ({ isKernelClientReady: mockKernelReady }) }))
const mockGrant = jest.fn<Promise<{ ok: boolean; overviewFresh?: boolean }>, []>()
let mockLastError: GrantSessionKeyError | null = null
jest.mock('@/hooks/wallet/useGrantSessionKey', () => ({
    useGrantSessionKey: () => ({ grant: mockGrant, isGranting: false, lastError: mockLastError }),
}))

// The server's funding decision; undefined is an unread or failed decision.
let mockAccess: { fundingMode: 'legacy' | 'managed'; enrollmentAllowed: boolean } | undefined
jest.mock('@/hooks/useCardFundingAccess', () => {
    const { fundingSetupPath } = jest.requireActual('@/utils/rain-funding.utils')
    return {
        useCardFundingAccess: () => ({ access: mockAccess, setupPath: fundingSetupPath(mockAccess) }),
    }
})

type MockCard = { id?: string; status: string; hasWithdrawApproval: boolean; hasStoredWithdrawApproval?: boolean }
let mockCards: MockCard[] = []
let mockSpendingPower: number | null = null
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({
        overview: {
            cards: mockCards,
            status: { contractAddress: '0xabc', coordinatorAddress: '0xdef' },
            balance: mockSpendingPower === null ? null : { spendingPower: mockSpendingPower },
        },
    }),
}))

jest.mock('@sentry/nextjs', () => ({
    captureMessage: jest.fn(),
}))
import * as Sentry from '@sentry/nextjs'

jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: (props: {
        visible: boolean
        title?: string
        description?: string
        ctas?: { text: string; onClick: () => void; disabled?: boolean }[]
        tertiaryCta?: { text: string; disabled?: boolean; onClick?: () => void }
    }) =>
        props.visible ? (
            <div data-testid="modal">
                <h3>{props.title}</h3>
                <p>{props.description}</p>
                {props.ctas?.map((c) => (
                    <button key={c.text} onClick={c.onClick} disabled={c.disabled}>
                        {c.text}
                    </button>
                ))}
                {props.tertiaryCta && (
                    <button onClick={props.tertiaryCta.onClick} disabled={props.tertiaryCta.disabled}>
                        {props.tertiaryCta.text}
                    </button>
                )}
            </div>
        ) : null,
}))

import EnableAutoBalanceBanner from '../EnableAutoBalanceBanner'
import { resetFundingPromptHoldsForTests } from '@/features/attention/cardFunding'

const onActed = jest.fn()
const onSnoozed = jest.fn()
const surfaceProps = {
    presentation: 'modal',
    askId: 'finish-card-setup',
    onActed,
    onDismissed: jest.fn(),
    onSnoozed,
} as const

beforeEach(() => {
    mockKernelReady = true
    jest.clearAllMocks()
    mockLastError = null
    mockGrant.mockResolvedValue({ ok: false })
    mockCards = [{ id: 'card-a', status: 'ACTIVE', hasWithdrawApproval: false }]
    mockSpendingPower = null
    mockAccess = { fundingMode: 'legacy', enrollmentAllowed: false }
    resetFundingPromptHoldsForTests()
})

describe('EnableAutoBalanceBanner — the funding decision', () => {
    it('prompts an account on the existing permission that managed funding is not open to', () => {
        render(<EnableAutoBalanceBanner {...surfaceProps} />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    it.each([
        ['open to managed funding', { fundingMode: 'legacy', enrollmentAllowed: true }],
        ['managed', { fundingMode: 'managed', enrollmentAllowed: true }],
        ['managed after new enrollment closed', { fundingMode: 'managed', enrollmentAllowed: false }],
        ['unread or failed', undefined],
    ] as const)('shows nothing for an account whose decision is %s', (_name, access) => {
        mockAccess = access ? { ...access } : undefined
        render(<EnableAutoBalanceBanner {...surfaceProps} />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockGrant).not.toHaveBeenCalled()
    })
})

describe('EnableAutoBalanceBanner', () => {
    it('shows only Continue (no escape) before any error', () => {
        render(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )
        expect(screen.getByText('Continue')).toBeInTheDocument()
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
    })

    it('after a cancelled/failed passkey, surfaces an escape so the non-dismissible modal cannot trap the user', () => {
        mockLastError = { kind: 'user-cancelled' }
        render(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )
        const skip = screen.getByText('Skip for now')
        expect(skip).toBeInTheDocument()
        fireEvent.click(skip)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    it('surfaces a recoverable message + Try again on a hard error', () => {
        mockLastError = { kind: 'unexpected', message: 'boom' }
        render(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )
        expect(screen.getByText(/couldn't finish setting up your card/i)).toBeInTheDocument()
        expect(screen.getByText('Try again')).toBeInTheDocument()
    })

    it('explains a rejected approval signature without blaming a passkey', () => {
        mockLastError = { kind: 'signature-rejected', message: 'rejected' }
        render(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )
        expect(screen.getByText(/passkey signature for this card could not be verified/i)).toBeInTheDocument()
        expect(screen.queryByText(/couldn't finish setting up your card/i)).not.toBeInTheDocument()
        expect(screen.getByText('Try again')).toBeInTheDocument()
        expect(screen.getByText('Skip for now')).toBeInTheDocument()
    })

    it('keys off the ACTIVE card, not cards[0] — a CANCELED newest row with a granted older card hides the modal', () => {
        // The post-remediation nicnode shape: duplicate canceled, real card granted.
        mockCards = [
            { id: 'card-dup', status: 'CANCELED', hasWithdrawApproval: false },
            { id: 'card-real', status: 'ACTIVE', hasWithdrawApproval: true },
        ]
        render(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    it('still prompts when the ACTIVE card lacks the grant even behind a CANCELED newest row', () => {
        mockCards = [
            { id: 'card-dup', status: 'CANCELED', hasWithdrawApproval: false },
            { id: 'card-real', status: 'ACTIVE', hasWithdrawApproval: false },
        ]
        render(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )
        expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    it('a grant that "succeeds" without clearing the modal reveals the escape and pages Sentry (dup-card lockout shape)', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
        mockGrant.mockResolvedValue({ ok: true, overviewFresh: true })
        // Overview never flips hasWithdrawApproval — the lockout shape.
        render(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()

        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })

        expect(screen.getByText('Skip for now')).toBeInTheDocument()
        // The stuck state must EXPLAIN itself — happy-path copy with an
        // unexplained Skip button just makes users re-tap Continue forever.
        expect(screen.getByText(/couldn't finish setting up your card/i)).toBeInTheDocument()
        expect(screen.getByText('Try again')).toBeInTheDocument()
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('duplicate-card lockout shape'))
        expect(Sentry.captureMessage).toHaveBeenCalledWith(
            expect.stringContaining('hasWithdrawApproval never flipped'),
            expect.objectContaining({ level: 'error' })
        )
        warnSpy.mockRestore()
    })

    it('a grant whose overview refetch FAILED is stale, not stuck — no escape, no Sentry page', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
        // Grant succeeded but the follow-up refetch died (flaky network):
        // the cached flag is stale; treating it as the lockout would false-page.
        mockGrant.mockResolvedValue({ ok: true, overviewFresh: false })
        render(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )

        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })

        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
        expect(Sentry.captureMessage).not.toHaveBeenCalled()
        warnSpy.mockRestore()
    })

    it('skipping a stuck card does NOT suppress the prompt for a different card later in the session', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
        mockGrant.mockResolvedValue({ ok: true, overviewFresh: true })
        mockCards = [{ id: 'card-a', status: 'ACTIVE', hasWithdrawApproval: false }]
        const { rerender } = render(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )

        // Card A gets stuck; user escapes via Skip.
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })
        fireEvent.click(screen.getByText('Skip for now'))
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

        // Support cancels A; ungranted card B becomes active — it must prompt.
        mockCards = [
            { id: 'card-a', status: 'CANCELED', hasWithdrawApproval: false },
            { id: 'card-b', status: 'ACTIVE', hasWithdrawApproval: false },
        ]
        rerender(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        warnSpy.mockRestore()
    })

    it('a re-issued card does NOT inherit the stuck signal from an old card grant (no premature escape, no false Sentry page)', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
        // Model the REAL happy path: grant() refetches the overview before
        // resolving, so by the time it returns ok the flag is already flipped.
        mockGrant.mockImplementation(async () => {
            mockCards = [{ id: 'card-a', status: 'ACTIVE', hasWithdrawApproval: true }]
            return { ok: true, overviewFresh: true }
        })
        mockCards = [{ id: 'card-a', status: 'ACTIVE', hasWithdrawApproval: false }]
        const { rerender } = render(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )

        // Grant succeeds for card A and the flag flips — modal hides, all good.
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })
        rerender(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

        // Card A is replaced by card B, which legitimately needs its own setup:
        // fresh prompt, NO escape, NO Sentry noise.
        mockCards = [
            { id: 'card-a', status: 'CANCELED', hasWithdrawApproval: true },
            { id: 'card-b', status: 'ACTIVE', hasWithdrawApproval: false },
        ]
        rerender(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )
        // findActiveCard skips CANCELED → card-b drives the modal
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
        expect(Sentry.captureMessage).not.toHaveBeenCalled()
        warnSpy.mockRestore()
    })
    it("card A's failure does not leak error copy or the escape into a re-issued card B's first prompt", async () => {
        // Grant fails hard for card A → error copy + escape for A.
        mockGrant.mockResolvedValue({ ok: false })
        mockCards = [{ id: 'card-a', status: 'ACTIVE', hasWithdrawApproval: false }]
        const { rerender } = render(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })
        mockLastError = { kind: 'unexpected', message: 'boom' }
        rerender(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )
        expect(screen.getByText('Try again')).toBeInTheDocument()
        expect(screen.getByText('Skip for now')).toBeInTheDocument()

        // A is canceled, B issued — the hook's lastError is still set, but B
        // has never been attempted: fresh Continue, no error copy, no escape.
        mockCards = [
            { id: 'card-a', status: 'CANCELED', hasWithdrawApproval: false },
            { id: 'card-b', status: 'ACTIVE', hasWithdrawApproval: false },
        ]
        rerender(
            <EnableAutoBalanceBanner
                presentation="modal"
                askId="finish-card-setup"
                onActed={onActed}
                onDismissed={jest.fn()}
                onSnoozed={onSnoozed}
            />
        )
        expect(screen.getByText('Continue')).toBeInTheDocument()
        expect(screen.queryByText('Try again')).not.toBeInTheDocument()
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
    })
})

it('allows wallet initialization to retry and exposes Skip if it fails', async () => {
    mockKernelReady = false
    mockCards = [{ id: 'active', status: 'ACTIVE', hasWithdrawApproval: false }]
    mockGrant.mockImplementation(async () => {
        mockLastError = { kind: 'unexpected', message: 'Wallet initialization failed' }
        return { ok: false }
    })
    render(
        <EnableAutoBalanceBanner
            presentation="modal"
            askId="finish-card-setup"
            onActed={onActed}
            onDismissed={jest.fn()}
            onSnoozed={onSnoozed}
        />
    )
    const button = screen.getByRole('button', { name: 'Continue' })
    expect(button).toBeEnabled()
    await act(async () => {
        fireEvent.click(button)
    })
    expect(mockGrant).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
})

describe('EnableAutoBalanceBanner — settling the ask', () => {
    it('an ok grant whose fresh overview still lacks the approval is not settled', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {})
        mockGrant.mockResolvedValue({ ok: true, overviewFresh: true })
        render(<EnableAutoBalanceBanner {...surfaceProps} />)
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })
        expect(onActed).not.toHaveBeenCalled()
        expect(screen.getByText('Skip for now')).toBeInTheDocument()
    })

    it('an ok grant with a stale overview is not settled', async () => {
        mockGrant.mockResolvedValue({ ok: true, overviewFresh: false })
        render(<EnableAutoBalanceBanner {...surfaceProps} />)
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })
        expect(onActed).not.toHaveBeenCalled()
    })

    it('settles once the fresh overview shows the approval for the card it was granted for', async () => {
        mockGrant.mockImplementation(async () => {
            mockCards = [{ id: 'card-a', status: 'ACTIVE', hasWithdrawApproval: true }]
            return { ok: true, overviewFresh: true }
        })
        const { rerender } = render(<EnableAutoBalanceBanner {...surfaceProps} />)
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })
        rerender(<EnableAutoBalanceBanner {...surfaceProps} />)
        expect(onActed).toHaveBeenCalledTimes(1)
    })

    it('an approval that lands on a different card settles nothing', async () => {
        mockGrant.mockImplementation(async () => {
            mockCards = [
                { id: 'card-a', status: 'CANCELED', hasWithdrawApproval: false },
                { id: 'card-b', status: 'ACTIVE', hasWithdrawApproval: true },
            ]
            return { ok: true, overviewFresh: true }
        })
        const { rerender } = render(<EnableAutoBalanceBanner {...surfaceProps} />)
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })
        rerender(<EnableAutoBalanceBanner {...surfaceProps} />)
        expect(onActed).not.toHaveBeenCalled()
    })
})

// R2: a long-time cardholder is never told to finish setting up a card that already worked.
describe('EnableAutoBalanceBanner — an update for a card that already worked', () => {
    const title = () => screen.getByRole('heading', { level: 3 }).textContent
    const OUTDATED: MockCard = {
        id: 'card-a',
        status: 'ACTIVE',
        hasWithdrawApproval: false,
        hasStoredWithdrawApproval: true,
    }

    it('a new card finishes setup, before and after a failure', () => {
        const { rerender } = render(<EnableAutoBalanceBanner {...surfaceProps} />)
        expect(title()).toBe('Finish setting up the card')
        expect(screen.getByText('One passkey tap to start using your card.')).toBeInTheDocument()

        mockLastError = { kind: 'unexpected', message: 'boom' }
        rerender(<EnableAutoBalanceBanner {...surfaceProps} />)
        expect(title()).toBe('Finish setting up the card')
        expect(screen.getByText(/couldn't finish setting up your card/i)).toBeInTheDocument()
    })

    it.each([
        ['an outdated approval on file', () => (mockCards = [OUTDATED])],
        ['card balance', () => (mockSpendingPower = 1_250)],
    ])('a card with %s reads as an update, before and after a failure', (_evidence, arrange) => {
        arrange()
        const { rerender } = render(<EnableAutoBalanceBanner {...surfaceProps} />)
        expect(title()).toBe('Card payments update')
        expect(screen.getByText('Approve the update with your passkey.')).toBeInTheDocument()

        mockLastError = { kind: 'unexpected', message: 'boom' }
        rerender(<EnableAutoBalanceBanner {...surfaceProps} />)
        expect(title()).toBe('Card payments update')
        expect(
            screen.getByText("We couldn't finish the update. Try again, or skip for now. We'll ask again later.")
        ).toBeInTheDocument()
        expect(screen.queryByText(/setting up|start using/i)).not.toBeInTheDocument()
    })

    it('an update stuck after an ok grant stays an update', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {})
        mockCards = [OUTDATED]
        mockGrant.mockResolvedValue({ ok: true, overviewFresh: true })
        render(<EnableAutoBalanceBanner {...surfaceProps} />)
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })
        expect(screen.getByText('Skip for now')).toBeInTheDocument()
        expect(title()).toBe('Card payments update')
        expect(screen.getByText(/couldn't finish the update/i)).toBeInTheDocument()
    })

    it('an approval its own grant stored is not evidence: a stuck new card keeps finishing setup', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {})
        mockGrant.mockImplementation(async () => {
            mockCards = [{ ...OUTDATED }]
            return { ok: true, overviewFresh: true }
        })
        const { rerender } = render(<EnableAutoBalanceBanner {...surfaceProps} />)
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })
        rerender(<EnableAutoBalanceBanner {...surfaceProps} />)
        expect(screen.getByText('Skip for now')).toBeInTheDocument()
        expect(title()).toBe('Finish setting up the card')
    })
})
