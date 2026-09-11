import { fireEvent, render, screen } from '@testing-library/react'
import { BottomNav } from '../index'

const mockPush = jest.fn()
let mockPathname = '/home'

jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
    useRouter: () => ({ push: mockPush }),
}))
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/hooks/useSupportUnread', () => ({ useSupportUnread: () => false }))
jest.mock('@/hooks/useForegroundPushRefresh', () => ({ useForegroundPushRefresh: () => {} }))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({
        isSupportModalOpen: false,
        setIsSupportModalOpen: jest.fn(),
        setIsQRScannerOpen: jest.fn(),
    }),
}))

let mockShowCardSurface = true
jest.mock('@/hooks/useCardSurfaceAccess', () => ({
    // typed to the real contract so a hook change breaks this suite loudly
    useCardSurfaceAccess: (): ReturnType<typeof import('@/hooks/useCardSurfaceAccess').useCardSurfaceAccess> => ({
        hasIssuedCard: mockShowCardSurface,
        hasCardRelationship: mockShowCardSurface,
        showCardSurface: mockShowCardSurface,
        cardHref: '/card',
    }),
}))

/*
 * The pill's transform is written imperatively during a drag and handed back
 * to CSS on release. The regression these pin (chip P22): a NO-OP release —
 * a sub-threshold tap, a cancelled pointer, a same-tab drag — must restore
 * the resting transform, not clear it. Clearing left the pill at x=0 until
 * the next tab change, because React saw no prop change and never rewrote
 * the style. In jsdom every measured box is {left: 0, width: 0}, so the
 * resting transform is translateX(-1px) — the assertion is that the string
 * is restored, never emptied.
 */
describe('BottomNav pill release', () => {
    beforeEach(() => {
        mockPathname = '/home'
        mockShowCardSurface = true
        mockPush.mockReset()
    })

    const restingTransform = 'translateX(-1px)'

    const getPill = () => {
        render(<BottomNav />)
        const pill = screen.getByTestId('bottom-nav-pill')
        expect(pill.style.transform).toBe(restingTransform)
        return pill
    }

    it('a sub-threshold tap restores the resting transform', () => {
        const pill = getPill()

        fireEvent.pointerDown(pill, { pointerId: 1, clientX: 100 })
        fireEvent.pointerUp(pill, { pointerId: 1, clientX: 102 })

        expect(pill.style.transform).toBe(restingTransform)
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('a cancelled pointer restores the resting transform', () => {
        const pill = getPill()

        fireEvent.pointerDown(pill, { pointerId: 1, clientX: 100 })
        fireEvent.pointerMove(pill, { pointerId: 1, clientX: 160 })
        fireEvent.pointerCancel(pill, { pointerId: 1, clientX: 160 })

        expect(pill.style.transform).toBe(restingTransform)
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('a same-tab drag release restores the resting transform', () => {
        const pill = getPill()

        // every tab box sits at x=0 in jsdom, so any release snaps to the
        // first (current) tab — a same-tab release by construction
        fireEvent.pointerDown(pill, { pointerId: 1, clientX: 100 })
        fireEvent.pointerMove(pill, { pointerId: 1, clientX: 130 })
        fireEvent.pointerUp(pill, { pointerId: 1, clientX: 130 })

        expect(pill.style.transform).toBe(restingTransform)
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('a finger down on a tab squashes its icon and release springs it back', () => {
        render(<BottomNav />)
        const supportTab = screen.getByRole('button', { name: 'support' })
        const icon = supportTab.querySelector('span')!

        expect(icon.className).not.toContain('scale-[0.82]')
        fireEvent.pointerDown(supportTab, { pointerId: 1 })
        expect(icon.className).toContain('scale-[0.82]')
        fireEvent.pointerUp(supportTab, { pointerId: 1 })
        expect(icon.className).not.toContain('scale-[0.82]')
    })

    it('leaving the tab routes clears the pill', () => {
        const { rerender } = render(<BottomNav />)
        expect(screen.getByTestId('bottom-nav-pill')).toBeInTheDocument()

        mockPathname = '/profile'
        rerender(<BottomNav />)
        expect(screen.queryByTestId('bottom-nav-pill')).not.toBeInTheDocument()
    })
})

/*
 * The middle slot is the card tab only while the card is attainable — a user
 * whose residence prohibits the card gets the exchange-rates page in that
 * slot instead. Applications are public, so the tab always links /card.
 */
const stubRect = (el: HTMLElement, left: number) => {
    el.getBoundingClientRect = () => ({ left, width: 68, right: left + 68, top: 0, bottom: 52, height: 52 }) as DOMRect
}

/*
 * jsdom has no PointerEvent, so `fireEvent.pointerMove(el, { clientX })` drops
 * clientX/pointerId and every drag reads as a zero-distance no-op (which is
 * why the suite above can only assert no-op releases). A MouseEvent carries
 * clientX for real; pointerId is defined on top of it.
 */
const pointer = (type: string, clientX: number) => {
    const event = new MouseEvent(type, { bubbles: true, clientX })
    Object.defineProperty(event, 'pointerId', { value: 1 })
    return event
}

describe('BottomNav middle slot', () => {
    beforeEach(() => {
        mockPathname = '/home'
        mockShowCardSurface = true
        mockPush.mockReset()
    })

    it('links the middle tab to /card', () => {
        render(<BottomNav />)
        expect(screen.getByLabelText('card')).toHaveAttribute('href', '/card')
        expect(screen.queryByLabelText('exchangeRates')).not.toBeInTheDocument()
    })

    it('swaps the middle tab to exchange rates when the card is not available', () => {
        mockShowCardSurface = false
        render(<BottomNav />)
        expect(screen.getByLabelText('exchangeRates')).toHaveAttribute('href', '/profile/exchange-rate')
        expect(screen.queryByLabelText('card')).not.toBeInTheDocument()
    })

    it('lights the pill on the exchange-rates route', () => {
        mockShowCardSurface = false
        mockPathname = '/profile/exchange-rate'
        render(<BottomNav />)
        expect(screen.getByTestId('bottom-nav-pill')).toBeInTheDocument()
    })

    it('keeps the pill lit on /card for a holder deep-linked there', () => {
        mockShowCardSurface = false
        mockPathname = '/card'
        render(<BottomNav />)
        expect(screen.getByTestId('bottom-nav-pill')).toBeInTheDocument()
    })

    it('a drag release onto the middle tab navigates to its swapped href', () => {
        mockShowCardSurface = false
        render(<BottomNav />)
        const pill = screen.getByTestId('bottom-nav-pill')

        // jsdom measures every box as {left: 0, width: 0}, so the release
        // would always snap to the first tab. Give the two tabs real centres
        // so the nearest-centre search can actually resolve to the middle one.
        stubRect(screen.getByLabelText('home'), 0)
        stubRect(screen.getByLabelText('exchangeRates'), 150)

        fireEvent(pill, pointer('pointerdown', 10))
        fireEvent(pill, pointer('pointermove', 160))
        fireEvent(pill, pointer('pointerup', 160))

        expect(mockPush).toHaveBeenCalledWith('/profile/exchange-rate')
    })
})
