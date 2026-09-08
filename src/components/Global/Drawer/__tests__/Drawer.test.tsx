import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from '..'
import { dispatchBackPress, resetBackHandlersForTests } from '@/utils/back-handler'
import { resetBottomNavVisibilityForTests, useBottomNavHidden } from '@/utils/bottom-nav-visibility'

const NavProbe = () => <span data-testid="nav-hidden">{String(useBottomNavHidden())}</span>

beforeAll(() => {
    window.matchMedia =
        window.matchMedia ||
        ((query: string) =>
            ({
                matches: false,
                media: query,
                addEventListener: () => {},
                removeEventListener: () => {},
                addListener: () => {},
                removeListener: () => {},
                dispatchEvent: () => false,
                onchange: null,
            }) as MediaQueryList)
})

describe('DrawerContent accessibility', () => {
    it('focuses the dialog without activating an input and restores its trigger on close', async () => {
        function Preview() {
            const [open, setOpen] = useState(false)
            return (
                <Drawer open={open} onOpenChange={setOpen}>
                    <DrawerTrigger>Open payment details</DrawerTrigger>
                    {/* jsdom does not finish Vaul's exit animation. Unmount the
                        content on close to exercise the focus-scope cleanup. */}
                    {open && (
                        <DrawerContent accessibleTitle="Payment details">
                            <input aria-label="Amount" />
                            <DrawerClose>Close payment details</DrawerClose>
                        </DrawerContent>
                    )}
                </Drawer>
            )
        }
        render(<Preview />)

        const trigger = screen.getByRole('button', { name: 'Open payment details' })
        trigger.focus()
        fireEvent.click(trigger)
        await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus())
        expect(screen.getByRole('textbox', { name: 'Amount' })).not.toHaveFocus()

        fireEvent.click(screen.getByRole('button', { name: 'Close payment details' }))
        await waitFor(() => expect(trigger).toHaveFocus())
    })

    it('renders a visually hidden DialogTitle from accessibleTitle', () => {
        render(
            <Drawer open>
                <DrawerContent accessibleTitle="Badge unlocked">
                    <div>body</div>
                </DrawerContent>
            </Drawer>
        )

        const dialog = screen.getByRole('dialog')
        const title = screen.getByText('Badge unlocked')
        expect(title).toHaveClass('sr-only')
        expect(dialog).toHaveAttribute('aria-labelledby', title.id)
    })

    it('labels the dialog with an explicit DrawerTitle child', () => {
        render(
            <Drawer open>
                <DrawerContent>
                    <DrawerTitle>Choose Network</DrawerTitle>
                </DrawerContent>
            </Drawer>
        )

        const dialog = screen.getByRole('dialog')
        const title = screen.getByText('Choose Network')
        expect(dialog).toHaveAttribute('aria-labelledby', title.id)
    })

    it('does not trigger the Radix missing-DialogTitle warning when accessibleTitle is set', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

        try {
            render(
                <Drawer open>
                    <DrawerContent accessibleTitle="Transaction Details">
                        <div>body</div>
                    </DrawerContent>
                </Drawer>
            )

            const logged = errorSpy.mock.calls.flat().join(' ')
            expect(logged).not.toContain('DialogTitle')
        } finally {
            errorSpy.mockRestore()
        }
    })
})

describe('Drawer hardware back', () => {
    beforeEach(() => {
        resetBackHandlersForTests()
        resetBottomNavVisibilityForTests()
    })

    const pressBack = () => {
        let consumed = false
        act(() => {
            consumed = dispatchBackPress()
        })
        return consumed
    }

    it('closes an open controlled drawer through onOpenChange and consumes the press', () => {
        const onOpenChange = jest.fn()
        render(
            <Drawer open onOpenChange={onOpenChange}>
                <DrawerContent accessibleTitle="Sheet">
                    <div>body</div>
                </DrawerContent>
            </Drawer>
        )

        expect(pressBack()).toBe(true)
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('consumes the press without closing a non-dismissible drawer', () => {
        const onOpenChange = jest.fn()
        render(
            <Drawer open onOpenChange={onOpenChange} dismissible={false}>
                <DrawerContent accessibleTitle="Sheet">
                    <div>body</div>
                </DrawerContent>
            </Drawer>
        )

        expect(pressBack()).toBe(true)
        expect(onOpenChange).not.toHaveBeenCalled()
    })

    it('never intercepts for a modal={false} sheet', () => {
        const onOpenChange = jest.fn()
        render(
            <Drawer open onOpenChange={onOpenChange} modal={false}>
                <DrawerContent accessibleTitle="Sheet">
                    <div>body</div>
                </DrawerContent>
            </Drawer>
        )

        expect(pressBack()).toBe(false)
        expect(onOpenChange).not.toHaveBeenCalled()
    })

    it('does not intercept while closed', () => {
        const onOpenChange = jest.fn()
        render(
            <Drawer open={false} onOpenChange={onOpenChange}>
                <DrawerContent accessibleTitle="Sheet">
                    <div>body</div>
                </DrawerContent>
            </Drawer>
        )

        expect(pressBack()).toBe(false)
    })

    it('opens and closes an uncontrolled DrawerTrigger drawer', async () => {
        render(
            <Drawer>
                <DrawerTrigger>open sheet</DrawerTrigger>
                <DrawerContent accessibleTitle="Sheet">
                    <div>body</div>
                </DrawerContent>
            </Drawer>
        )

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(pressBack()).toBe(false)

        fireEvent.click(screen.getByText('open sheet'))
        const dialog = await screen.findByRole('dialog')
        expect(dialog).toHaveAttribute('data-state', 'open')

        expect(pressBack()).toBe(true)
        // jsdom never fires vaul's exit animationend, so the node lingers: the
        // closed state and the released handler are the observable contract
        await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
        expect(pressBack()).toBe(false)
    })

    it('hands the press to a nested drawer before its parent', () => {
        const onOuterChange = jest.fn()
        const onInnerChange = jest.fn()
        render(
            <Drawer open onOpenChange={onOuterChange}>
                <DrawerContent accessibleTitle="Outer">
                    <Drawer nested open onOpenChange={onInnerChange}>
                        <DrawerContent accessibleTitle="Inner">
                            <div>inner body</div>
                        </DrawerContent>
                    </Drawer>
                </DrawerContent>
            </Drawer>
        )

        expect(pressBack()).toBe(true)
        expect(onInnerChange).toHaveBeenCalledWith(false)
        expect(onOuterChange).not.toHaveBeenCalled()
    })

    it('holds the bottom nav hidden only while open with hideBottomNav', () => {
        const view = render(
            <>
                <NavProbe />
                <Drawer open hideBottomNav>
                    <DrawerContent accessibleTitle="Sheet">
                        <div>body</div>
                    </DrawerContent>
                </Drawer>
            </>
        )
        expect(screen.getByTestId('nav-hidden')).toHaveTextContent('true')

        view.rerender(
            <>
                <NavProbe />
                <Drawer open={false} hideBottomNav>
                    <DrawerContent accessibleTitle="Sheet">
                        <div>body</div>
                    </DrawerContent>
                </Drawer>
            </>
        )
        expect(screen.getByTestId('nav-hidden')).toHaveTextContent('false')
    })

    it('does not touch the bottom nav without hideBottomNav or for a non-modal sheet', () => {
        render(
            <>
                <NavProbe />
                <Drawer open>
                    <DrawerContent accessibleTitle="Plain">
                        <div>body</div>
                    </DrawerContent>
                </Drawer>
                <Drawer open modal={false} hideBottomNav>
                    <DrawerContent accessibleTitle="Non-modal">
                        <div>body</div>
                    </DrawerContent>
                </Drawer>
            </>
        )
        expect(screen.getByTestId('nav-hidden')).toHaveTextContent('false')
    })
})
