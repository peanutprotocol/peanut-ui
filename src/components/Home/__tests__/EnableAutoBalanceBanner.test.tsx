/**
 * EnableAutoBalanceBanner — escape-hatch regression
 *
 * The modal is preventClose + hideModalCloseButton. Before this fix `void grant()`
 * discarded the result, so a cancelled/failed passkey left the user trapped with a
 * button that appeared to do nothing. The fix surfaces the error and adds a "Skip
 * for now" escape once a grant has failed.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { GrantSessionKeyError } from '@/hooks/wallet/useGrantSessionKey'

const mockGrant = jest.fn()
let mockLastError: GrantSessionKeyError | null = null
jest.mock('@/hooks/wallet/useGrantSessionKey', () => ({
    useGrantSessionKey: () => ({ grant: mockGrant, isGranting: false, lastError: mockLastError }),
}))

jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({
        overview: {
            cards: [{ status: 'ACTIVE', hasWithdrawApproval: false }],
            status: { contractAddress: '0xabc', coordinatorAddress: '0xdef' },
        },
    }),
}))

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
})
