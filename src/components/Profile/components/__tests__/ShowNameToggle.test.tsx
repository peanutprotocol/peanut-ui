/**
 * ShowNameToggle — the confirmation gate. Turning the setting ON publishes the
 * user's legal name next to their username, so it must ask first; turning it
 * OFF saves straight away.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import ShowNameToggle from '@/components/Profile/components/ShowNameToggle'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

const mockUpdateUserById = jest.fn()
const mockFetchUser = jest.fn()

jest.mock('@/app/actions/users', () => ({ updateUserById: (...a: unknown[]) => mockUpdateUserById(...a) }))
const mockToastError = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ fetchUser: mockFetchUser, user: { user: { userId: 'u1' } } }),
}))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ visible, title, ctas }: any) =>
        visible ? (
            <div data-testid="modal">
                <h1>{title}</h1>
                {ctas?.map((c: any, i: number) => (
                    <button key={i} onClick={c.onClick}>
                        {c.text}
                    </button>
                ))}
            </div>
        ) : null,
}))

beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateUserById.mockResolvedValue({ data: {} })
})

describe('ShowNameToggle', () => {
    it('asks before turning the setting on, and saves once confirmed', async () => {
        const onChange = jest.fn()
        render(<ShowNameToggle checked={false} onChange={onChange} />)

        fireEvent.click(screen.getByRole('switch'))
        expect(screen.getByText('Show your full name?')).toBeInTheDocument()
        expect(mockUpdateUserById).not.toHaveBeenCalled()
        expect(onChange).not.toHaveBeenCalled()

        fireEvent.click(screen.getByText('Confirm'))
        expect(onChange).toHaveBeenCalledWith(true)
        await waitFor(() => expect(mockUpdateUserById).toHaveBeenCalledWith({ userId: 'u1', showFullName: true }))
    })

    it('cancelling leaves the setting off', () => {
        const onChange = jest.fn()
        render(<ShowNameToggle checked={false} onChange={onChange} />)

        fireEvent.click(screen.getByRole('switch'))
        fireEvent.click(screen.getByText('Cancel'))

        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockUpdateUserById).not.toHaveBeenCalled()
        expect(onChange).not.toHaveBeenCalled()
    })

    it('turning it off saves without a confirmation', async () => {
        const onChange = jest.fn()
        render(<ShowNameToggle checked onChange={onChange} />)

        fireEvent.click(screen.getByRole('switch'))

        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(onChange).toHaveBeenCalledWith(false)
        await waitFor(() => expect(mockUpdateUserById).toHaveBeenCalledWith({ userId: 'u1', showFullName: false }))
    })

    it('reverts the optimistic value when the save resolves an error', async () => {
        // updateUserById resolves { error } for a non-2xx or a network failure;
        // it never rejects. Treating that as success left this screen claiming
        // the legal name was hidden while the server still published it.
        mockUpdateUserById.mockResolvedValueOnce({ error: 'nope' })
        const onChange = jest.fn()
        render(<ShowNameToggle checked onChange={onChange} />)

        fireEvent.click(screen.getByRole('switch'))

        await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(true))
        expect(mockToastError).toHaveBeenCalled()
        expect(mockFetchUser).not.toHaveBeenCalled()
    })
})
