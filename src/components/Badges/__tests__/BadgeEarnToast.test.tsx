import { render, screen, act } from '@testing-library/react'
import BadgeEarnToast from '@/components/Badges/BadgeEarnToast'

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
    default: (props: any) => {
        const { unoptimized, fill, ...rest } = props
        return <img {...rest} />
    },
}))

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const mockToast = jest.fn()
const mockDismissToast = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ toast: mockToast, dismiss: mockDismissToast }),
}))

const mockMarkSeen = jest.fn()
let mockPending: Array<{ code: string; name: string; description: string | null; earnedAt: string }> = []
jest.mock('@/components/Badges/useBadgeEarnToast', () => ({
    useBadgeEarnToast: () => ({ pending: mockPending, markSeen: mockMarkSeen }),
}))

// Minimal stub: surface the title so we can assert the detail modal opened.
jest.mock('@/components/Badges/BadgeDetailModal', () => ({
    BadgeDetailModal: ({ isOpen, title }: any) => (isOpen ? <div data-testid="badge-detail-modal">{title}</div> : null),
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
        expect(mockMarkSeen).toHaveBeenCalledWith(['PRODUCT_HUNT'])
        expect(captureMock).toHaveBeenCalledWith('badge_earn_toast_shown', { count: 1 })

        const content = mockToast.mock.calls[0][0].content
        act(() => content.props.onClick())

        expect(mockDismissToast).toHaveBeenCalledWith('badge-earn')
        expect(captureMock).toHaveBeenCalledWith('badge_earn_toast_tapped', { count: 1 })
        expect(screen.getByTestId('badge-detail-modal')).toHaveTextContent('Product Hunt')
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('coalesces multiple badges and routes to /badges on tap', () => {
        mockPending = [badge('SHHHHH', 'Shhh'), badge('PRODUCT_HUNT', 'Product Hunt')]
        render(<BadgeEarnToast />)

        expect(mockToast).toHaveBeenCalledTimes(1)
        expect(mockMarkSeen).toHaveBeenCalledWith(['SHHHHH', 'PRODUCT_HUNT'])

        const content = mockToast.mock.calls[0][0].content
        render(content)
        expect(screen.getByText(/You unlocked 2 badges/)).toBeInTheDocument()

        act(() => content.props.onClick())
        expect(mockRouterPush).toHaveBeenCalledWith('/badges')
        expect(screen.queryByTestId('badge-detail-modal')).not.toBeInTheDocument()
    })
})
