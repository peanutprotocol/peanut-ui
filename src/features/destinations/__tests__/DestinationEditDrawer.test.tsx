/**
 * One drawer serves both tables, so the thing worth pinning is that it writes
 * through the adapter it was handed — a bank account must not be renamed by
 * the address-book call, and an address-book row keeps its delete button while
 * an account, which has no delete endpoint, does not.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import DestinationEditDrawer, { type EditableDestination } from '../DestinationEditDrawer'

jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
    DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DrawerDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

const account = (overrides: Partial<EditableDestination> = {}): EditableDestination => ({
    id: 'account-1',
    name: '',
    identifier: '···· 0802',
    maxLength: 15,
    rename: jest.fn().mockResolvedValue(undefined),
    ...overrides,
})

const open = (destination: EditableDestination, onClose = jest.fn()) => {
    render(<DestinationEditDrawer destination={destination} onClose={onClose} />, { wrapper: IntlWrapper })
    return onClose
}

const save = () => screen.getByRole('button', { name: /save/i })

it('renames through the adapter it was given, with the name trimmed', async () => {
    const destination = account()
    const onClose = open(destination)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Payroll  ' } })
    fireEvent.click(save())

    await waitFor(() => expect(destination.rename).toHaveBeenCalledWith('account-1', 'Payroll'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
})

it('an address-book row can be deleted, a bank account cannot', () => {
    const remove = jest.fn().mockResolvedValue(undefined)
    const { unmount } = render(
        <DestinationEditDrawer
            destination={account({ id: 'address-1', remove, removeLabel: 'Delete address' })}
            onClose={jest.fn()}
        />,
        { wrapper: IntlWrapper }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete address' }))
    expect(remove).toHaveBeenCalledWith('address-1')
    unmount()

    open(account())
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
})

it('keeps the drawer open and says so when the write fails', async () => {
    const destination = account({ rename: jest.fn().mockRejectedValue(new Error('nope')) })
    const onClose = open(destination)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Payroll' } })
    fireEvent.click(save())

    await screen.findByText(/could not save the name/i)
    expect(onClose).not.toHaveBeenCalled()
})
