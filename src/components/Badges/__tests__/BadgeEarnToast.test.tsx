import { render as rtlRender, screen, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import type { ComponentProps } from 'react'
import BadgeEarnToast from '@/components/Badges/BadgeEarnToast'

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

// next/navigation — mutable pathname so we can exercise the /home gate.
let mockPathname = '/home'
jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
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

    it('fires a non-interactive toast for a single badge', () => {
        mockPending = [badge('PRODUCT_HUNT', 'Product Hunt')]
        render(<BadgeEarnToast />)

        expect(mockToast).toHaveBeenCalledTimes(1)
        expect(mockToast.mock.calls[0][0].id).toBe('badge-earn:PRODUCT_HUNT')
        expect(mockMarkSeen).toHaveBeenCalledWith(['PRODUCT_HUNT'])
        expect(captureMock).toHaveBeenCalledWith('badge_earn_toast_shown', { count: 1 })

        render(mockToast.mock.calls[0][0].content)
        expect(screen.getByText(/Product Hunt/)).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        expect(screen.queryByText(/tap to view/i)).not.toBeInTheDocument()
    })

    it('renders the API iconUrl instead of the local legacy asset', () => {
        mockPending = [{ ...badge('PRODUCT_HUNT', 'Backend Name'), iconUrl: '/badges/backend_product_hunt.webp' }]
        render(<BadgeEarnToast />)

        const { container } = render(mockToast.mock.calls[0][0].content)
        expect(container.querySelector('img')).toHaveAttribute('src', '/badges/backend_product_hunt.webp')
        // a code in `badges.catalog` renders the localized name, not the backend one
        expect(screen.getByText(/Product Hunt/)).toBeInTheDocument()
    })

    it('falls back to the code, not the backend name, for a code with no catalog entry', () => {
        mockPending = [badge('FUTURE_BADGE', 'Backend Name')]
        render(<BadgeEarnToast />)

        render(mockToast.mock.calls[0][0].content)
        expect(screen.getByText(/FUTURE_BADGE/)).toBeInTheDocument()
        expect(screen.queryByText(/Backend Name/)).not.toBeInTheDocument()
    })

    it('announces unlocked avatars in a non-interactive second toast 500ms later (TASK-22142)', () => {
        jest.useFakeTimers()
        mockPending = [badge('BUG_WHISPERER', 'Bug Whisperer')]
        render(<BadgeEarnToast />)

        // badge toast fires immediately; the avatar toast hasn't yet
        expect(mockToast).toHaveBeenCalledTimes(1)

        act(() => jest.advanceTimersByTime(499))
        expect(mockToast).toHaveBeenCalledTimes(1)

        act(() => jest.advanceTimersByTime(1))
        expect(mockToast).toHaveBeenCalledTimes(2)
        expect(mockToast.mock.calls[1][0].id).toBe('badge-earn-avatar:BUG_WHISPERER')

        render(mockToast.mock.calls[1][0].content)
        expect(screen.getByText(/3 new avatars unlocked/)).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        expect(screen.queryByText(/Choose avatar/)).not.toBeInTheDocument()
        jest.useRealTimers()
    })

    it('announces avatars when an older badge in a coalesced batch has art', () => {
        jest.useFakeTimers()
        mockPending = [badge('PRODUCT_HUNT', 'Product Hunt'), badge('SHHHHH', 'Shhh')]
        render(<BadgeEarnToast />)

        act(() => jest.advanceTimersByTime(500))
        render(mockToast.mock.calls[1][0].content)
        expect(screen.getByText(/3 new avatars unlocked/)).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        jest.useRealTimers()
    })

    it('says nothing about avatars for a badge that has none', () => {
        jest.useFakeTimers()
        mockPending = [badge('PRODUCT_HUNT', 'Product Hunt')]
        render(<BadgeEarnToast />)

        act(() => jest.advanceTimersByTime(500))
        expect(mockToast).toHaveBeenCalledTimes(1)
        jest.useRealTimers()
    })

    it('coalesces multiple badges without an action', () => {
        mockPending = [badge('SHHHHH', 'Shhh'), badge('PRODUCT_HUNT', 'Product Hunt')]
        render(<BadgeEarnToast />)

        expect(mockToast).toHaveBeenCalledTimes(1)
        expect(mockMarkSeen).toHaveBeenCalledWith(['SHHHHH', 'PRODUCT_HUNT'])

        render(mockToast.mock.calls[0][0].content)
        expect(screen.getByText(/You unlocked 2 badges/)).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
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
