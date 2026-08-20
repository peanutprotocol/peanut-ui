import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import CancelSendLinkDrawer from '../index'

const setup = (props: Partial<React.ComponentProps<typeof CancelSendLinkDrawer>> = {}) => {
    const onClick = jest.fn()
    const setShowCancelLinkDrawer = jest.fn()
    render(
        <IntlWrapper>
            <CancelSendLinkDrawer
                showCancelLinkDrawer
                setShowCancelLinkDrawer={setShowCancelLinkDrawer}
                amount="$ 25.00"
                onClick={onClick}
                {...props}
            />
        </IntlWrapper>
    )
    return { onClick, setShowCancelLinkDrawer }
}

describe('CancelSendLinkDrawer', () => {
    it('renders as a bottom drawer, not a centered modal', () => {
        setup()

        const dialog = screen.getByRole('dialog')
        expect(dialog).toHaveAttribute('data-vaul-drawer')
        expect(dialog).toHaveAttribute('data-vaul-drawer-direction', 'bottom')
    })

    it('keeps the confirmation copy and the amount at risk', () => {
        setup()

        expect(screen.getByText('Cancel this link?')).toBeInTheDocument()
        expect(screen.getByText('$ 25.00')).toBeInTheDocument()
        expect(screen.getByText(/nobody will be able to claim it/i)).toBeInTheDocument()
    })

    it('runs the cancel when the CTA is pressed', () => {
        const { onClick } = setup()

        fireEvent.click(screen.getByRole('button', { name: /cancel & return funds/i }))
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    // The cancel is an on-chain claim-back — once it is in flight there is nothing
    // to back out to, so the drawer must not be dismissible mid-flight.
    it('locks the CTA and blocks dismissal while cancelling', () => {
        setup({ isLoading: true })

        expect(screen.getByRole('button')).toBeDisabled()
        expect(screen.getByRole('dialog')).toHaveAttribute('data-vaul-drawer')
    })

    // Opened from the transaction details drawer. A plain Root nested in a Root
    // double-applies vaul's background scale and fights over the scroll lock, so
    // this path has to go through NestedRoot.
    it('opens on top of the transaction drawer when nested', () => {
        render(
            <IntlWrapper>
                <Drawer open>
                    <DrawerContent>
                        <DrawerTitle>Transaction</DrawerTitle>
                        <CancelSendLinkDrawer
                            nested
                            showCancelLinkDrawer
                            setShowCancelLinkDrawer={jest.fn()}
                            amount="$ 25.00"
                            onClick={jest.fn()}
                        />
                    </DrawerContent>
                </Drawer>
            </IntlWrapper>
        )

        // `hidden: true` because vaul aria-hides the parent while the child has focus
        expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(2)
        expect(screen.getByText('Cancel this link?')).toBeInTheDocument()
        // the parent drawer is still mounted underneath, not replaced
        expect(screen.getByText('Transaction')).toBeInTheDocument()
    })
})
