import { render as rtlRender, screen, act } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import BadgeEarnToast from '@/components/Badges/BadgeEarnToast'

const IntlWrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        {children}
    </NextIntlClientProvider>
)
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
let mockPending: Array<{ code: string; name: string; description: string | null; earnedAt: string }> = []
jest.mock('@/components/Badges/useBadgeEarnToast', () => ({
    useBadgeEarnToast: () => ({ pending: mockPending, markSeen: mockMarkSeen }),
}))

// Minimal stub: surface the title so we can assert the detail modal opened.
jest.mock('@/components/Badges/BadgeDetailModal', () => ({
    BadgeDetailModal: ({ isOpen, title }: { isOpen: boolean; title: string }) =>
        isOpen ? <div data-testid="badge-detail-modal">{title}</div> : null,
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

        const content = mockToast.mock.calls[0][0].content
        act(() => content.props.onClick())

        expect(mockDismissToast).toHaveBeenCalledWith('badge-earn:PRODUCT_HUNT')
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

    it('dismisses the live toast when the user navigates away from /home', () => {
        mockPending = [badge('PRODUCT_HUNT', 'Product Hunt')]
        const { rerender } = render(<BadgeEarnToast />)
        expect(mockToast).toHaveBeenCalledTimes(1)

        mockPathname = '/send'
        rerender(<BadgeEarnToast />)
        expect(mockDismissToast).toHaveBeenCalledWith('badge-earn:PRODUCT_HUNT')
    })
})
