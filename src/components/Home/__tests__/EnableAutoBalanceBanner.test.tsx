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
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { GrantSessionKeyError } from '@/hooks/wallet/useGrantSessionKey'

const mockGrant = jest.fn<Promise<{ ok: boolean }>, []>()
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
    mockCards = [{ status: 'ACTIVE', hasWithdrawApproval: false }]
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
            { status: 'CANCELED', hasWithdrawApproval: false },
            { status: 'ACTIVE', hasWithdrawApproval: true },
        ]
        render(<EnableAutoBalanceBanner />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    it('still prompts when the ACTIVE card lacks the grant even behind a CANCELED newest row', () => {
        mockCards = [
            { status: 'CANCELED', hasWithdrawApproval: false },
            { status: 'ACTIVE', hasWithdrawApproval: false },
        ]
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    it('a grant that "succeeds" without clearing the modal reveals the escape and pages Sentry (dup-card lockout shape)', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
        mockGrant.mockResolvedValue({ ok: true })
        // Overview never flips hasWithdrawApproval — the lockout shape.
        render(<EnableAutoBalanceBanner />)
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()

        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })

        expect(screen.getByText('Skip for now')).toBeInTheDocument()
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('duplicate-card lockout shape'))
        expect(Sentry.captureMessage).toHaveBeenCalledWith(
            expect.stringContaining('hasWithdrawApproval never flipped'),
            expect.objectContaining({ level: 'error' })
        )
        warnSpy.mockRestore()
    })
})
