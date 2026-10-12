import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import ProvideEmailStep from '../ProvideEmailStep'

let mockEmail: string
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-1', email: mockEmail } }, fetchUser: jest.fn() }),
}))
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn() }))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ visible, content }: { visible: boolean; content: React.ReactNode }) =>
        visible ? <div>{content}</div> : null,
}))

const props = { onComplete: jest.fn(), onSkip: jest.fn() }
beforeEach(() => {
    mockEmail = 'signup@example.com'
})

it('prefills the saved signup email and lets the user edit it', () => {
    renderWithIntl(<ProvideEmailStep visible {...props} />)
    expect(screen.getByRole('textbox')).toHaveValue('signup@example.com')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'replacement@example.com' } })
    expect(screen.getByRole('textbox')).toHaveValue('replacement@example.com')
})

it('adopts a late email refresh only until the user edits the field', () => {
    mockEmail = ''
    const view = renderWithIntl(<ProvideEmailStep visible {...props} />)
    mockEmail = 'signup@example.com'
    view.rerender(<ProvideEmailStep visible {...props} />)
    expect(screen.getByRole('textbox')).toHaveValue('signup@example.com')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'replacement@example.com' } })
    mockEmail = 'updated-profile@example.com'
    view.rerender(<ProvideEmailStep visible {...props} />)
    expect(screen.getByRole('textbox')).toHaveValue('replacement@example.com')
})

it('starts a new opening with the current saved email', () => {
    const view = renderWithIntl(<ProvideEmailStep visible {...props} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'replacement@example.com' } })
    view.rerender(<ProvideEmailStep visible={false} {...props} />)
    mockEmail = 'updated-profile@example.com'
    view.rerender(<ProvideEmailStep visible {...props} />)
    expect(screen.getByRole('textbox')).toHaveValue('updated-profile@example.com')
})
