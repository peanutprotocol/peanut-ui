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
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({
        isSupportModalOpen: false,
        setIsSupportModalOpen: jest.fn(),
        setIsQRScannerOpen: jest.fn(),
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

    it('leaving the tab routes clears the pill', () => {
        const { rerender } = render(<BottomNav />)
        expect(screen.getByTestId('bottom-nav-pill')).toBeInTheDocument()

        mockPathname = '/profile'
        rerender(<BottomNav />)
        expect(screen.queryByTestId('bottom-nav-pill')).not.toBeInTheDocument()
    })
})
