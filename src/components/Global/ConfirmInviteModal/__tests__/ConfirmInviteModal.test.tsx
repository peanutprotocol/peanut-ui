import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import ConfirmInviteModal from '../index'

jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))

const renderModal = () => {
    const handleContinueWithPeanut = jest.fn()
    const handleLoseInvite = jest.fn()
    render(
        <IntlWrapper>
            <ConfirmInviteModal
                isOpen
                onClose={jest.fn()}
                username="maria"
                handleContinueWithPeanut={handleContinueWithPeanut}
                handleLoseInvite={handleLoseInvite}
            />
        </IntlWrapper>
    )
    return { handleContinueWithPeanut, handleLoseInvite }
}

test('names the sender, says what signing up gives, and offers the rail without an account', () => {
    renderModal()
    expect(screen.getByText('maria invited you to Peanut')).toBeInTheDocument()
    expect(
        screen.getByText('Sign up to receive the money in Peanut, or continue with the method you chose.')
    ).toBeInTheDocument()
})

test('the primary button signs up and claims; the secondary claims without signing up', () => {
    const { handleContinueWithPeanut, handleLoseInvite } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Sign up and claim' }))
    expect(handleContinueWithPeanut).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Continue without signing up' }))
    expect(handleLoseInvite).toHaveBeenCalledTimes(1)
})
