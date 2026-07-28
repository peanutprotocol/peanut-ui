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
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, act } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'

const IntlWrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        {children}
    </NextIntlClientProvider>
)
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })
import type { GrantSessionKeyError } from '@/hooks/wallet/useGrantSessionKey'

const mockGrant = jest.fn<Promise<{ ok: boolean; overviewFresh?: boolean }>, []>()
let mockLastError: GrantSessionKeyError | null = null
jest.mock('@/hooks/wallet/useGrantSessionKey', () => ({
    useGrantSessionKey: () => ({ grant: mockGrant, isGranting: false, lastError: mockLastError }),
}))

type MockCard = { id?: string; status: string; hasWithdrawApproval: boolean }
let mockCards: MockCard[] = []
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({
        overview: {
            cards: mockCards,
            status: { contractAddress: '0xabc', coordinatorAddress: '0xdef' },
        },
    }),
}))

jest.mock('@sentry/nextjs', () => ({
    captureMessage: jest.fn(),
}))
import * as Sentry from '@sentry/nextjs'

jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: (props: { visible: boolean; description?: string; ctas?: { text: string; onClick: () => void }[] }) =>
        props.visible ? (
            <div data-testid="modal">
                <p>{props.description}</p>
                {props.ctas?.map((c) => (
                    <button key={c.text} onClick={c.onClick}>
                        {c.text}
                    </button>
                ))}
            </div>
        ) : null,
}))

import EnableAutoBalanceBanner from '../EnableAutoBalanceBanner'

beforeEach(() => {
    jest.clearAllMocks()
    mockLastError = null
    mockGrant.mockResolvedValue({ ok: false })
    mockCards = [{ id: 'card-a', status: 'ACTIVE', hasWithdrawApproval: false }]
})

describe('EnableAutoBalanceBanner', () => {
    it('shows only Continue (no escape) before any error', () => {
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByText('Continue')).toBeInTheDocument()
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
    })

    it('after a cancelled/failed passkey, surfaces an escape so the non-dismissible modal cannot trap the user', () => {
        mockLastError = { kind: 'user-cancelled' }
        render(<EnableAutoBalanceBanner />)
        const skip = screen.getByText('Skip for now')
        expect(skip).toBeInTheDocument()
        fireEvent.click(skip)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    it('surfaces a recoverable message + Try again on a hard error', () => {
        mockLastError = { kind: 'unexpected', message: 'boom' }
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByText(/couldn't finish setting up your card/i)).toBeInTheDocument()
        expect(screen.getByText('Try again')).toBeInTheDocument()
    })

    it('keys off the ACTIVE card, not cards[0] — a CANCELED newest row with a granted older card hides the modal', () => {
        // The post-remediation nicnode shape: duplicate canceled, real card granted.
        mockCards = [
            { id: 'card-dup', status: 'CANCELED', hasWithdrawApproval: false },
            { id: 'card-real', status: 'ACTIVE', hasWithdrawApproval: true },
        ]
        render(<EnableAutoBalanceBanner />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    it('still prompts when the ACTIVE card lacks the grant even behind a CANCELED newest row', () => {
        mockCards = [
            { id: 'card-dup', status: 'CANCELED', hasWithdrawApproval: false },
            { id: 'card-real', status: 'ACTIVE', hasWithdrawApproval: false },
        ]
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    it('a grant that "succeeds" without clearing the modal reveals the escape and pages Sentry (dup-card lockout shape)', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
        mockGrant.mockResolvedValue({ ok: true, overviewFresh: true })
        // Overview never flips hasWithdrawApproval — the lockout shape.
        render(<EnableAutoBalanceBanner />)
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
        render(<EnableAutoBalanceBanner />)

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
        const { rerender } = render(<EnableAutoBalanceBanner />)

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
        rerender(<EnableAutoBalanceBanner />)
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
        const { rerender } = render(<EnableAutoBalanceBanner />)

        // Grant succeeds for card A and the flag flips — modal hides, all good.
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })
        rerender(<EnableAutoBalanceBanner />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

        // Card A is replaced by card B, which legitimately needs its own setup:
        // fresh prompt, NO escape, NO Sentry noise.
        mockCards = [
            { id: 'card-a', status: 'CANCELED', hasWithdrawApproval: true },
            { id: 'card-b', status: 'ACTIVE', hasWithdrawApproval: false },
        ]
        rerender(<EnableAutoBalanceBanner />)
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
        const { rerender } = render(<EnableAutoBalanceBanner />)
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })
        mockLastError = { kind: 'unexpected', message: 'boom' }
        rerender(<EnableAutoBalanceBanner />)
        expect(screen.getByText('Try again')).toBeInTheDocument()
        expect(screen.getByText('Skip for now')).toBeInTheDocument()

        // A is canceled, B issued — the hook's lastError is still set, but B
        // has never been attempted: fresh Continue, no error copy, no escape.
        mockCards = [
            { id: 'card-a', status: 'CANCELED', hasWithdrawApproval: false },
            { id: 'card-b', status: 'ACTIVE', hasWithdrawApproval: false },
        ]
        rerender(<EnableAutoBalanceBanner />)
        expect(screen.getByText('Continue')).toBeInTheDocument()
        expect(screen.queryByText('Try again')).not.toBeInTheDocument()
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
    })
})
