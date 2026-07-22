import { render, screen } from '@testing-library/react'
import { Drawer, DrawerContent, DrawerTitle } from '..'

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
