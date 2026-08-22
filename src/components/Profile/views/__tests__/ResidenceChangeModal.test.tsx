/** @jest-environment jsdom */
import React from 'react'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import ResidenceChangeModal from '@/components/Profile/views/ResidenceChangeModal'
import { updateUserById } from '@/app/actions/users'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn() }))
const mockedUpdate = updateUserById as jest.MockedFunction<typeof updateUserById>

const render = (props?: Partial<React.ComponentProps<typeof ResidenceChangeModal>>) => {
    const onClose = jest.fn()
    const onSaved = jest.fn()
    const onReverify = jest.fn()
    rtlRender(
        <ResidenceChangeModal
            visible
            onClose={onClose}
            userId="u1"
            declared="ES"
            verified="BR"
            onSaved={onSaved}
            onReverify={onReverify}
            {...props}
        />,
        { wrapper: IntlWrapper }
    )
    return { onClose, onSaved, onReverify }
}

describe('ResidenceChangeModal', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockedUpdate.mockResolvedValue({ data: undefined })
    })

    it('saves the declared residence, refetches, and closes', async () => {
        const { onClose, onSaved, onReverify } = render()
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(mockedUpdate).toHaveBeenCalledWith({ userId: 'u1', residenceCountry: 'ES' })
        expect(onSaved).toHaveBeenCalled()
        expect(onReverify).not.toHaveBeenCalled()
    })

    it('offers re-verification only when the pick differs from the verified residence', () => {
        render()
        expect(screen.getByText('Save & re-verify now')).toBeInTheDocument()
    })

    it('hides re-verification when declared matches verified', () => {
        render({ declared: 'BR', verified: 'BR' })
        expect(screen.queryByText('Save & re-verify now')).not.toBeInTheDocument()
    })

    it('save-and-reverify saves first, then starts the restart flow', async () => {
        const { onReverify } = render()
        fireEvent.click(screen.getByText('Save & re-verify now'))
        await waitFor(() => expect(onReverify).toHaveBeenCalled())
        expect(mockedUpdate).toHaveBeenCalled()
    })

    it('a failed save surfaces the error and never closes or re-verifies', async () => {
        mockedUpdate.mockResolvedValue({ error: 'nope' })
        const { onClose, onReverify } = render()
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => expect(screen.getByText('nope')).toBeInTheDocument())
        expect(onClose).not.toHaveBeenCalled()
        expect(onReverify).not.toHaveBeenCalled()
    })

    it('warns when the picked country is restricted', () => {
        render({ declared: 'RU', verified: null })
        expect(
            screen.getByText(
                "Heads up: bank transfers and card issuing aren't available for residents of this country."
            )
        ).toBeInTheDocument()
    })
})
