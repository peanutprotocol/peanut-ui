import { render as rtlRender, screen, act, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import type { ComponentProps } from 'react'
import BadgeEarnToast from '@/components/Badges/BadgeEarnToast'

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

// next/navigation — mutable pathname so we can exercise the /home gate; stable
// router object so the effect doesn't re-fire on the tap-triggered re-render.
let mockPathname = '/home'
const mockRouterPush = jest.fn()
const mockRouter = { push: mockRouterPush }
jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
    useRouter: () => mockRouter,
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, fill, ...rest }: ComponentProps<'img'> & { unoptimized?: boolean; fill?: boolean }) => (
        <img {...rest} />
    ),
}))

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const mockToast = jest.fn()
const mockDismissToast = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ toast: mockToast, dismiss: mockDismissToast }),
}))

const mockMarkSeen = jest.fn()
let mockPending: Array<{
    code: string
    name: string
    description: string | null
    iconUrl?: string | null
    earnedAt: string
}> = []
jest.mock('@/components/Badges/useBadgeEarnToast', () => ({
    useBadgeEarnToast: () => ({ pending: mockPending, markSeen: mockMarkSeen }),
}))

// Minimal stub: surface the title so we can assert the detail modal opened.
jest.mock('@/components/Badges/BadgeDetailModal', () => ({
    BadgeDetailModal: ({ isOpen, title, code }: { isOpen: boolean; title: string; code?: string }) =>
        isOpen ? (
            <div data-testid="badge-detail-modal" data-code={code}>
                {title}
            </div>
        ) : null,
}))

import posthog from 'posthog-js'
const captureMock = (posthog as unknown as { capture: jest.Mock }).capture

const badge = (code: string, name: string) => ({
    code,
    name,
    description: null,
    earnedAt: new Date().toISOString(),
})

beforeEach(() => {
    jest.clearAllMocks()
    mockPathname = '/home'
    mockPending = []
})

describe('BadgeEarnToast', () => {
    it('does nothing when not on /home', () => {
        mockPathname = '/setup'
        mockPending = [badge('PRODUCT_HUNT', 'Product Hunt')]
        render(<BadgeEarnToast />)
        expect(mockToast).not.toHaveBeenCalled()
        expect(mockMarkSeen).not.toHaveBeenCalled()
    })

    it('does nothing when there are no fresh badges', () => {
        render(<BadgeEarnToast />)
        expect(mockToast).not.toHaveBeenCalled()
    })

    it('fires one toast for a single badge and opens the detail modal on tap', () => {
        mockPending = [badge('PRODUCT_HUNT', 'Product Hunt')]
        render(<BadgeEarnToast />)

        expect(mockToast).toHaveBeenCalledTimes(1)
        expect(mockToast.mock.calls[0][0].id).toBe('badge-earn:PRODUCT_HUNT')
        expect(mockMarkSeen).toHaveBeenCalledWith(['PRODUCT_HUNT'])
        expect(captureMock).toHaveBeenCalledWith('badge_earn_toast_shown', { count: 1 })

        render(mockToast.mock.calls[0][0].content)
        act(() => fireEvent.click(screen.getByRole('button', { name: /tap to view/ })))

        expect(mockDismissToast).toHaveBeenCalledWith('badge-earn:PRODUCT_HUNT')
        expect(captureMock).toHaveBeenCalledWith('badge_earn_toast_tapped', { count: 1, target: 'badge_detail' })
        expect(screen.getByTestId('badge-detail-modal')).toHaveTextContent('Product Hunt')
        expect(screen.getByTestId('badge-detail-modal')).toHaveAttribute('data-code', 'PRODUCT_HUNT')
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('renders the API iconUrl instead of the local legacy asset', () => {
        mockPending = [{ ...badge('PRODUCT_HUNT', 'Backend Name'), iconUrl: '/badges/backend_product_hunt.webp' }]
        render(<BadgeEarnToast />)

        const { container } = render(mockToast.mock.calls[0][0].content)
        expect(container.querySelector('img')).toHaveAttribute('src', '/badges/backend_product_hunt.webp')
        // a code in `badges.catalog` renders the localized name, not the backend one
        expect(screen.getByText(/Product Hunt/)).toBeInTheDocument()
    })

    it('falls back to the backend name for a code with no catalog entry', () => {
        mockPending = [badge('FUTURE_BADGE', 'Backend Name')]
        render(<BadgeEarnToast />)

        render(mockToast.mock.calls[0][0].content)
        expect(screen.getByText(/Backend Name/)).toBeInTheDocument()
    })

    it('announces unlocked avatars and hands the user to the picker (TASK-22142)', () => {
        mockPending = [badge('BUG_WHISPERER', 'Bug Whisperer')]
        render(<BadgeEarnToast />)

        render(mockToast.mock.calls[0][0].content)
        expect(screen.getByText(/3 new avatars unlocked/)).toBeInTheDocument()

        act(() => fireEvent.click(screen.getByRole('button', { name: /Choose avatar/ })))
        expect(mockDismissToast).toHaveBeenCalledWith('badge-earn:BUG_WHISPERER')
        // the badge rides along so the first hand holds its art
        expect(mockRouterPush).toHaveBeenCalledWith('/profile?avatarPicker=true&badge=BUG_WHISPERER')
        expect(screen.queryByTestId('badge-detail-modal')).not.toBeInTheDocument()
    })

    it('says nothing about avatars for a badge that has none', () => {
        mockPending = [badge('PRODUCT_HUNT', 'Product Hunt')]
        render(<BadgeEarnToast />)

        render(mockToast.mock.calls[0][0].content)
        expect(screen.queryByText(/avatar/i)).not.toBeInTheDocument()
    })

    it('coalesces multiple badges and routes to /badges on tap', () => {
        mockPending = [badge('SHHHHH', 'Shhh'), badge('PRODUCT_HUNT', 'Product Hunt')]
        render(<BadgeEarnToast />)

        expect(mockToast).toHaveBeenCalledTimes(1)
        expect(mockMarkSeen).toHaveBeenCalledWith(['SHHHHH', 'PRODUCT_HUNT'])

        render(mockToast.mock.calls[0][0].content)
        expect(screen.getByText(/You unlocked 2 badges/)).toBeInTheDocument()

        act(() => fireEvent.click(screen.getByRole('button', { name: /tap to view/ })))
        expect(mockRouterPush).toHaveBeenCalledWith('/badges')
        expect(screen.queryByTestId('badge-detail-modal')).not.toBeInTheDocument()
    })

    it('dismisses the live toast when the user navigates away from /home', () => {
        mockPending = [badge('PRODUCT_HUNT', 'Product Hunt')]
        const { rerender } = render(<BadgeEarnToast />)
        expect(mockToast).toHaveBeenCalledTimes(1)

        mockPathname = '/send'
        rerender(<BadgeEarnToast />)
        expect(mockDismissToast).toHaveBeenCalledWith('badge-earn:PRODUCT_HUNT')
    })
})
