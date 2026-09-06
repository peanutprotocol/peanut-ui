import { act, render, screen } from '@testing-library/react'
import { AppShell } from '..'
import { acquireBottomNavHide, resetBottomNavVisibilityForTests } from '@/utils/bottom-nav-visibility'

describe('AppShell bottom nav slot', () => {
    beforeEach(() => {
        resetBottomNavVisibilityForTests()
    })

    it('renders the nav slot interactive by default', () => {
        render(
            <AppShell variant="app" nav={<button>nav</button>}>
                <div>content</div>
            </AppShell>
        )

        const slot = screen.getByTestId('app-shell-nav')
        expect(slot).not.toHaveClass('translate-y-full')
        expect(slot).not.toHaveAttribute('inert')
    })

    it('slides the nav out and makes it inert while a hide is held', () => {
        render(
            <AppShell variant="app" nav={<button>nav</button>}>
                <div>content</div>
            </AppShell>
        )

        let release: () => void = () => {}
        act(() => {
            release = acquireBottomNavHide()
        })
        const slot = screen.getByTestId('app-shell-nav')
        expect(slot).toHaveClass('translate-y-full')
        expect(slot).toHaveAttribute('inert')

        act(() => release())
        expect(slot).not.toHaveClass('translate-y-full')
        expect(slot).not.toHaveAttribute('inert')
    })

    it('omits the slot entirely without a nav', () => {
        render(
            <AppShell variant="app">
                <div>content</div>
            </AppShell>
        )
        expect(screen.queryByTestId('app-shell-nav')).not.toBeInTheDocument()
    })
})
