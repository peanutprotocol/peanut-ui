/**
 * "Back to home" on a success screen replaces the finished flow's entry. A
 * pushed /home kept the request or send under it, so back from home reopened
 * the flow the user had just completed (QA-09, TASK-23054).
 */

import { act, fireEvent, render, screen } from '@testing-library/react'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { __testing } from '@/hooks/useSafeBack'

jest.mock('@/components/TransactionDetails/TransactionDetailsDrawer', () => ({
    TransactionDetailsDrawer: () => null,
}))

jest.mock('@/hooks/useTransactionDetailsDrawer', () => ({
    useTransactionDetailsDrawer: () => ({
        selectedTxId: null,
        isTransactionSelected: () => false,
        openTransactionDetails: jest.fn(),
        closeTransactionDetails: jest.fn(),
    }),
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'viewer-1' }, invitedBy: null } }),
}))

jest.mock('@/hooks/useTokenChainIcons', () => ({
    useTokenChainIcons: () => ({
        tokenIconUrl: undefined,
        chainIconUrl: undefined,
        resolvedChainName: 'Arbitrum',
        resolvedTokenSymbol: 'USDC',
    }),
}))

jest.mock('@/hooks/usePointsConfetti', () => ({ usePointsConfetti: () => undefined }))
jest.mock('@/hooks/useAppReviewNudge', () => ({ useAppReviewNudge: () => undefined }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/utils/demo-transactions', () => ({ recordDemoTransaction: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))

// Presentational children pull in icons/haptics/media that jsdom can't render;
// the receipt id is built in the parent, so stub them to focus the test.
jest.mock('@/components/Global/SoundPlayer', () => ({ SoundPlayer: () => null }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/0_Bruddle/PageStack', () => ({
    PageStack: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
        Center: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    }),
}))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
        <button type="button" onClick={onClick}>
            {children}
        </button>
    ),
}))
jest.mock('@/components/0_Bruddle/IconBubble', () => ({ IconBubble: () => null }))
jest.mock('@/components/Global/Card', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/AddressLink', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CreateAccountButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Common/PointsCard', () => ({ __esModule: true, default: () => null }))

beforeEach(() => {
    mockPush.mockClear()
    mockReplace.mockClear()
    window.history.replaceState(null, '', '/')
    __testing.reset()
})

describe('PaymentSuccessView done', () => {
    it.each(['SEND', 'REQUEST', 'DEPOSIT'] as const)(
        '%s: back to home replaces when home is not in history, never pushes',
        (type) => {
            render(<PaymentSuccessView type={type} amount="5" />)
            fireEvent.click(screen.getByText('success.backToHome'))

            expect(mockReplace).toHaveBeenCalledWith('/home')
            expect(mockPush).not.toHaveBeenCalled()
        }
    )

    it('with the flow in history, rewinds past all of it to home', async () => {
        window.history.pushState({}, '', '/home')
        window.history.pushState({}, '', '/send')
        window.history.pushState({}, '', '/send/alice')
        render(<PaymentSuccessView type="SEND" amount="5" />)

        const popped = new Promise<void>((resolve) =>
            window.addEventListener('popstate', () => resolve(), { once: true })
        )
        fireEvent.click(screen.getByText('success.backToHome'))
        await act(() => popped)

        expect(window.location.pathname).toBe('/home')
        expect(mockReplace).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('keeps the caller redirect, still as a replace', () => {
        render(<PaymentSuccessView type="SEND" amount="5" redirectTo="/request" />)
        fireEvent.click(screen.getByText('success.backToHome'))

        expect(mockReplace).toHaveBeenCalledWith('/request')
        expect(mockPush).not.toHaveBeenCalled()
    })
})
