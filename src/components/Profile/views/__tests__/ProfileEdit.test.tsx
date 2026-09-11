import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { ProfileEditView } from '../ProfileEdit.view'
import { updateUserById, requestEmailChange } from '@/app/actions/users'

const mockReplace = jest.fn()
const mockFetchUser = jest.fn()
const mockResetCrispSessions = jest.fn()
const mockInvalidateCrispToken = jest.fn()
let mockVerified = false
let mockUser: {
    profileNameLocked?: boolean
    user: { userId: string; username: string; fullName: string; email: string }
} | null
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn(), requestEmailChange: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser, fetchUser: mockFetchUser }) }))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isVerified: mockVerified, isLoading: false }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace }) }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/utils/crisp', () => ({
    resetCrispProxySessions: (...args: unknown[]) => mockResetCrispSessions(...args),
}))
jest.mock('@/hooks/useCrispTokenId', () => ({
    invalidateCrispTokenId: (...args: unknown[]) => mockInvalidateCrispToken(...args),
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('../../components/ProfileHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('../../components/ShowNameToggle', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Settings/DeleteAccountButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))

const save = () => fireEvent.click(screen.getByRole('button', { name: /Save Changes|Send code/ }))
const verify = async () => {
    await screen.findByLabelText('Verification code')
    expect(updateUserById).not.toHaveBeenCalled()
    await change('Verification code', '123456')
    save()
}
const change = async (label: string, value: string) => {
    await act(async () => {
        fireEvent.change(screen.getByLabelText(label), { target: { value } })
    })
    await waitFor(() => expect(screen.getByRole('button', { name: /Save Changes|Send code/ })).toBeEnabled())
}

beforeEach(() => {
    jest.clearAllMocks()
    mockVerified = false
    mockUser = { user: { userId: 'test-user', username: 'testuser', fullName: 'Test User', email: 'old@example.com' } }
    jest.mocked(updateUserById).mockResolvedValue({})
    jest.mocked(requestEmailChange).mockResolvedValue({})
    mockFetchUser.mockResolvedValue(undefined)
    mockResetCrispSessions.mockResolvedValue(undefined)
})

test.each([false, true])('email is editable with verified=%s and only the changed email is sent', async (verified) => {
    mockVerified = verified
    renderWithIntl(<ProfileEditView />)
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
    expect(screen.getByLabelText('Email for notifications')).toBeEnabled()
    await change('Email for notifications', ' new@example.com ')
    save()
    await verify()
    await waitFor(() =>
        expect(updateUserById).toHaveBeenCalledWith({
            userId: 'test-user',
            email: 'new@example.com',
            emailVerificationCode: '123456',
        })
    )
    expect(mockResetCrispSessions).toHaveBeenCalledTimes(1)
    expect(mockInvalidateCrispToken).toHaveBeenCalledWith('test-user')
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/profile'))
})

test('keeps the replacement identity gated when the old native support session cannot reset', async () => {
    mockResetCrispSessions.mockRejectedValueOnce(new Error('native reset failed'))
    renderWithIntl(<ProfileEditView />)
    await change('Email for notifications', 'new@example.com')
    save()
    await verify()

    await waitFor(() => expect(mockResetCrispSessions).toHaveBeenCalledTimes(1))
    expect(mockInvalidateCrispToken).not.toHaveBeenCalled()
    expect(mockFetchUser).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
})

test('verified names explain the lock while an unverified name can be saved', async () => {
    const view = renderWithIntl(<ProfileEditView />)
    await change('Name', 'New')
    save()
    await waitFor(() => expect(updateUserById).toHaveBeenCalledWith({ userId: 'test-user', fullName: 'New User' }))
    mockVerified = true
    view.rerender(<ProfileEditView />)
    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(screen.getByLabelText('Surname')).toBeDisabled()
    expect(screen.getByText(/Your name comes from your identity verification/)).toBeVisible()
})

test.each(['', 'invalid', 'a@'])('rejects invalid changed email %s inline', async (email) => {
    renderWithIntl(<ProfileEditView />)
    await change('Email for notifications', email)
    save()
    expect(await screen.findByText('Please enter a valid email address.')).toBeVisible()
    expect(updateUserById).not.toHaveBeenCalled()
})

test('rejects an empty changed name', async () => {
    renderWithIntl(<ProfileEditView />)
    await change('Name', ' ')
    save()
    expect(await screen.findByText('Please provide your name.')).toBeVisible()
    expect(updateUserById).not.toHaveBeenCalled()
})

test('email-only save does not require a missing name', async () => {
    mockUser!.user.fullName = ''
    renderWithIntl(<ProfileEditView />)
    await change('Email for notifications', 'new@example.com')
    save()
    await verify()
    await waitFor(() =>
        expect(updateUserById).toHaveBeenCalledWith({
            userId: 'test-user',
            email: 'new@example.com',
            emailVerificationCode: '123456',
        })
    )
})

test('shows server failures and retains edits without navigating', async () => {
    jest.mocked(updateUserById).mockResolvedValue({ error: 'Could not save your profile' })
    renderWithIntl(<ProfileEditView />)
    await change('Email for notifications', 'new@example.com')
    save()
    await verify()
    expect(await screen.findByText('Could not save your profile')).toBeVisible()
    expect(screen.getByLabelText('Email for notifications')).toHaveValue('new@example.com')
    expect(mockReplace).not.toHaveBeenCalled()
})

test('background refresh preserves edits and does not send an untouched stale name', async () => {
    const view = renderWithIntl(<ProfileEditView />)
    await change('Email for notifications', 'new@example.com')
    mockUser = { user: { ...mockUser!.user, fullName: 'New Verified Name' } }
    mockVerified = true
    view.rerender(<ProfileEditView />)
    expect(screen.getByLabelText('Name')).toHaveValue('New Verified')
    expect(screen.getByLabelText('Email for notifications')).toHaveValue('new@example.com')
    save()
    await verify()
    await waitFor(() =>
        expect(updateUserById).toHaveBeenCalledWith({
            userId: 'test-user',
            email: 'new@example.com',
            emailVerificationCode: '123456',
        })
    )
})

test('late auth hydrates without enabling a no-op save', async () => {
    const user = mockUser
    mockUser = null
    const view = renderWithIntl(<ProfileEditView />)
    expect(screen.getByLabelText('Email for notifications')).toBeDisabled()
    mockUser = user
    view.rerender(<ProfileEditView />)
    expect(screen.getByLabelText('Email for notifications')).toHaveValue('old@example.com')
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
})

test('a duplicate email error is linked to its input and can be corrected', async () => {
    jest.mocked(requestEmailChange).mockResolvedValueOnce({
        error: 'This email is already associated with another account',
    })
    renderWithIntl(<ProfileEditView />)
    await change('Email for notifications', 'taken@example.com')
    save()
    expect(await screen.findByText('This email is already associated with another account.')).toBeVisible()
    expect(screen.getByLabelText('Email for notifications')).toHaveAccessibleDescription(
        'This email is already associated with another account.'
    )
    await change('Email for notifications', 'available@example.com')
    save()
    await verify()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/profile'))
})

test('a previously verified name stays locked during re-verification', () => {
    mockUser!.profileNameLocked = true
    mockVerified = false
    renderWithIntl(<ProfileEditView />)
    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(screen.getByText(/Your name comes from your identity verification/)).toBeVisible()
    expect(screen.getByLabelText('Email for notifications')).toBeEnabled()
})
test('changing the pending mailbox requires a new code', async () => {
    renderWithIntl(<ProfileEditView />)
    await change('Email for notifications', 'first@example.com')
    save()
    await screen.findByLabelText('Verification code')
    await change('Email for notifications', 'second@example.com')
    expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument()
    save()
    await waitFor(() => expect(requestEmailChange).toHaveBeenLastCalledWith('second@example.com'))
    expect(updateUserById).not.toHaveBeenCalled()
})
