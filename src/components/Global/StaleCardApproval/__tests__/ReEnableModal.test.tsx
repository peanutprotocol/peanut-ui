/** @jest-environment jsdom */
/**
 * StaleCardApprovalReEnableModal — global recovery prompt for the
 * 409 STALE_CARD_APPROVAL withdraw refusal.
 *
 * Hidden until `RAIN_STALE_APPROVAL_EVENT` fires; then it offers a re-enable
 * CTA that reuses the session-key grant. A successful grant flips to a "try
 * again" confirmation; a failed grant surfaces a recoverable message.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, act } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import { RAIN_STALE_APPROVAL_EVENT } from '@/services/rain'

const IntlWrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        {children}
    </NextIntlClientProvider>
)
const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

const mockGrant = jest.fn<Promise<{ ok: boolean; error?: { kind: string } }>, []>()
jest.mock('@/hooks/wallet/useGrantSessionKey', () => ({
    useGrantSessionKey: () => ({ grant: mockGrant, isGranting: false }),
}))

jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: (props: {
        visible: boolean
        title?: string
        description?: string
        ctas?: { text: string; onClick: () => void }[]
    }) =>
        props.visible ? (
            <div data-testid="modal">
                <h3>{props.title}</h3>
                <p>{props.description}</p>
                {props.ctas?.map((c) => (
                    <button key={c.text} onClick={c.onClick}>
                        {c.text}
                    </button>
                ))}
            </div>
        ) : null,
}))

import StaleCardApprovalReEnableModal from '../ReEnableModal'

const fireStaleEvent = () =>
    act(() => {
        window.dispatchEvent(new CustomEvent(RAIN_STALE_APPROVAL_EVENT))
    })

beforeEach(() => {
    jest.clearAllMocks()
    mockGrant.mockResolvedValue({ ok: false, error: { kind: 'unexpected' } })
})

describe('StaleCardApprovalReEnableModal', () => {
    it('is hidden until the stale-approval event fires', () => {
        render(<StaleCardApprovalReEnableModal />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

        fireStaleEvent()
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(screen.getByText('Re-enable your card')).toBeInTheDocument()
        expect(screen.getByText('Re-enable card')).toBeInTheDocument()
    })

    it('a successful grant flips to the "try your withdrawal again" confirmation', async () => {
        mockGrant.mockResolvedValue({ ok: true })
        render(<StaleCardApprovalReEnableModal />)
        fireStaleEvent()

        await act(async () => {
            fireEvent.click(screen.getByText('Re-enable card'))
        })

        expect(mockGrant).toHaveBeenCalledTimes(1)
        expect(screen.getByText('Card re-enabled')).toBeInTheDocument()
        expect(screen.getByText(/try your withdrawal again/i)).toBeInTheDocument()
    })

    it('a failed grant surfaces a recoverable message and keeps the retry CTA', async () => {
        render(<StaleCardApprovalReEnableModal />)
        fireStaleEvent()

        await act(async () => {
            fireEvent.click(screen.getByText('Re-enable card'))
        })

        expect(screen.getByText(/couldn't re-enable your card/i)).toBeInTheDocument()
        expect(screen.getByText('Re-enable card')).toBeInTheDocument()
    })

    it('can be dismissed with "Not now"', () => {
        render(<StaleCardApprovalReEnableModal />)
        fireStaleEvent()
        fireEvent.click(screen.getByText('Not now'))
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
})
