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

    it('starts app content 16px below the safe-area boundary', () => {
        const { container } = render(
            <AppShell variant="app">
                <div>content</div>
            </AppShell>
        )

        const content = container.querySelector('#scrollable-content')
        expect(content).toHaveClass('pt-4', 'pb-6')
        expect(content).not.toHaveClass('py-6')
    })

    /* The page width bug: with px-4 on the scroll container the centering
       margins swallow it past the cap, so a page rendered 448 wide on desktop
       while the bottom nav spanned 416. The inset belongs inside the cap, on
       the same element that carries max-w-md, so both come out 416. */
    it('puts the screen inset inside the capped column, not on the scroll container', () => {
        const { container } = render(
            <AppShell variant="app">
                <div>content</div>
            </AppShell>
        )

        const content = container.querySelector('#scrollable-content')
        expect(content).not.toHaveClass('px-4')

        const column = content?.firstElementChild
        expect(column).toHaveClass('max-w-md', 'px-4', 'mx-auto')
    })
})

describe('AppShell onboarding tint', () => {
    it('reserves the bottom inset after content and covers content scrolling beneath it', () => {
        const { container } = render(
            <AppShell variant="onboarding" bottomInsetClassName="bg-white" modals={<div data-testid="modal" />}>
                <button>Last action</button>
            </AppShell>
        )

        const spacer = screen.getByRole('button', { name: 'Last action' }).nextElementSibling
        expect(spacer).toHaveClass('h-safe-bottom', 'bg-white')
        expect(spacer).toHaveAttribute('aria-hidden', 'true')
        expect(spacer).not.toHaveClass('fixed')
        const cover = container.querySelector('div.fixed.bottom-0')
        expect(cover).toHaveClass('h-safe-bottom', 'bg-white', 'z-40', 'pointer-events-none')
        expect(cover).not.toHaveClass('-z-10')
        expect(cover?.nextElementSibling).toBe(screen.getByTestId('modal'))
    })

    it('uses the shared hero color for the banner and edge-to-edge safe areas', () => {
        const { container } = render(
            <AppShell variant="onboarding" bottomInsetClassName="setup-hero-background" banner={<div>Banner</div>}>
                <div>Setup</div>
            </AppShell>
        )

        expect(screen.getByText('Banner').parentElement).toHaveClass('setup-hero-background')
        expect(container.querySelector('.top-0.h-safe-top')).toHaveClass('setup-hero-background')
        expect(container.querySelector('.bottom-0.h-safe-bottom')).toHaveClass('setup-hero-background')
    })
})
