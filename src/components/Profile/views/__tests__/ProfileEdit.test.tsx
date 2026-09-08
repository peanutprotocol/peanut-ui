import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { ProfileEditView } from '../ProfileEdit.view'
import { updateUserById } from '@/app/actions/users'

const mockReplace = jest.fn()
const mockFetchUser = jest.fn()
let mockVerified = false
let mockUser: { user: { userId: string; username: string; fullName: string; email: string } } | null
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser, fetchUser: mockFetchUser }) }))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isVerified: mockVerified, isLoading: false }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace }) }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('../../components/ProfileHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('../../components/ShowNameToggle', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Settings/DeleteAccountButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
const change = async (label: string, value: string) => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled())
}

beforeEach(() => {
    jest.clearAllMocks()
    mockVerified = false
    mockUser = { user: { userId: 'test-user', username: 'testuser', fullName: 'Test User', email: 'old@example.com' } }
    jest.mocked(updateUserById).mockResolvedValue({})
    mockFetchUser.mockResolvedValue(undefined)
})

test.each([false, true])('email is editable with verified=%s and only the changed email is sent', async (verified) => {
    mockVerified = verified
    renderWithIntl(<ProfileEditView />)
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
    expect(screen.getByLabelText('Email')).toBeEnabled()
    await change('Email', ' new@example.com ')
    save()
    await waitFor(() => expect(updateUserById).toHaveBeenCalledWith({ userId: 'test-user', email: 'new@example.com' }))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/profile'))
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
    await change('Email', email)
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
    await change('Email', 'new@example.com')
    save()
    await waitFor(() => expect(updateUserById).toHaveBeenCalledWith({ userId: 'test-user', email: 'new@example.com' }))
})

test('shows server failures and retains edits without navigating', async () => {
    jest.mocked(updateUserById).mockResolvedValue({ error: 'This email is already associated with another account' })
    renderWithIntl(<ProfileEditView />)
    await change('Email', 'new@example.com')
    save()
    expect(await screen.findByText('This email is already associated with another account')).toBeVisible()
    expect(screen.getByLabelText('Email')).toHaveValue('new@example.com')
    expect(mockReplace).not.toHaveBeenCalled()
})

test('background refresh preserves edits and does not send an untouched stale name', async () => {
    const view = renderWithIntl(<ProfileEditView />)
    await change('Email', 'new@example.com')
    mockUser = { user: { ...mockUser!.user, fullName: 'New Verified Name' } }
    mockVerified = true
    view.rerender(<ProfileEditView />)
    save()
    await waitFor(() => expect(updateUserById).toHaveBeenCalledWith({ userId: 'test-user', email: 'new@example.com' }))
})

test('late auth hydrates without enabling a no-op save', async () => {
    const user = mockUser
    mockUser = null
    const view = renderWithIntl(<ProfileEditView />)
    expect(screen.getByLabelText('Email')).toBeDisabled()
    mockUser = user
    view.rerender(<ProfileEditView />)
    expect(screen.getByLabelText('Email')).toHaveValue('old@example.com')
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
})
