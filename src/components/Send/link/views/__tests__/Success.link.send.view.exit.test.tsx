/**
 * Leaving the send-link success screen for home unwinds the whole Send flow
 * (Chip, ui#3477). Home → Send pushes /send and the link CTA pushes
 * /send?view=link; replacing only the last entry left /send under home, so
 * browser back from home re-entered Send.
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { __testing } from '@/hooks/useSafeBack'

const mockReplace = jest.fn()
const mockCancelLinkAndClaim = jest.fn()
const mockPollForClaimConfirmation = jest.fn(async () => true)
const mockInvalidateQueries = jest.fn(async () => undefined)
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() }
const mockCaptureException = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))
jest.mock('@sentry/nextjs', () => ({ captureException: mockCaptureException }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/context/LinkSendFlowContext', () => ({
    useLinkSendFlow: () => ({
        link: 'https://peanut.me/claim#p=pw',
        attachmentOptions: { message: '' },
        tokenValue: '10',
        resetLinkSendFlow: jest.fn(),
    }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => ({ fetchBalance: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'u1' }, accounts: [{ type: 'peanut-wallet', identifier: '0xwallet' }] },
    }),
}))
jest.mock('@/components/Claim/useClaimLink', () => ({
    __esModule: true,
    default: () => ({
        cancelLinkAndClaim: mockCancelLinkAndClaim,
        pollForClaimConfirmation: mockPollForClaimConfirmation,
    }),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => mockToast }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        onClick,
        disabled,
    }: {
        children?: React.ReactNode
        onClick?: () => void
        disabled?: boolean
    }) => (
        <button onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}))
jest.mock('@/components/Global/CancelSendLinkDrawer', () => ({
    __esModule: true,
    default: ({ showCancelLinkDrawer, onClick }: { showCancelLinkDrawer: boolean; onClick: () => void }) =>
        showCancelLinkDrawer ? (
            <button data-testid="confirm-cancel" onClick={onClick}>
                confirm
            </button>
        ) : null,
}))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ onPrev }: { onPrev?: () => void }) => (
        <button data-testid="nav-back" onClick={onPrev}>
            back
        </button>
    ),
}))
jest.mock('@/components/Global/QRCodeWrapper', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/SuccessViewComponents/SuccessViewDetailsCard', () => ({
    SuccessViewDetailsCard: () => null,
}))

import LinkSendSuccessView from '../Success.link.send.view'

beforeEach(() => {
    jest.clearAllMocks()
    window.history.replaceState(null, '', '/')
    __testing.reset()
})

const landed = () =>
    new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }))

describe('LinkSendSuccessView — leaving for home', () => {
    test('Home → Send → Link → success → close rewinds to home, so back from home cannot reopen Send', async () => {
        window.history.pushState({}, '', '/home')
        window.history.pushState({}, '', '/send')
        window.history.pushState({}, '', '/send?view=link')
        render(<LinkSendSuccessView />)

        const popped = landed()
        fireEvent.click(screen.getByTestId('nav-back'))
        await act(() => popped)

        expect(window.location.pathname).toBe('/home')
        // the entry before home is where the tab started, not /send
        const back = landed()
        window.history.back()
        await act(() => back)
        expect(window.location.pathname).toBe('/')
        expect(mockReplace).not.toHaveBeenCalled()
    })

    test('opened cold (no in-app history), close replaces the page with home', () => {
        render(<LinkSendSuccessView />)
        fireEvent.click(screen.getByTestId('nav-back'))
        expect(mockReplace).toHaveBeenCalledWith('/home')
    })
})
