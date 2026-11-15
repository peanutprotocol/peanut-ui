import { NextIntlClientProvider } from 'next-intl'
import { APP_LOCALES } from '@/i18n/app/config'
import { loadMessages } from '@/i18n/app/messages'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { EmailSettings } from '../../components/EmailSettings'
import { updateUserById, requestEmailChange } from '@/app/actions/users'

const mockSaved = jest.fn()
const mockFetchUser = jest.fn()
const mockResetCrispSessions = jest.fn()
const mockInvalidateCrispToken = jest.fn()
let mockUser: {
    user: { userId: string; username: string; fullName: string; email: string }
} | null
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn(), requestEmailChange: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser, fetchUser: mockFetchUser }) }))
jest.mock('@/utils/crisp', () => ({
    resetCrispProxySessions: (...args: unknown[]) => mockResetCrispSessions(...args),
}))
jest.mock('@/hooks/useCrispTokenId', () => ({
    invalidateCrispTokenId: (...args: unknown[]) => mockInvalidateCrispToken(...args),
}))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))

const save = () => fireEvent.click(screen.getByRole('button', { name: /Save changes|Send code/ }))
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
    await waitFor(() => expect(screen.getByRole('button', { name: /Save changes|Send code/ })).toBeEnabled())
}

beforeEach(() => {
    jest.clearAllMocks()
    mockUser = { user: { userId: 'test-user', username: 'testuser', fullName: 'Test User', email: 'old@example.com' } }
    jest.mocked(updateUserById).mockResolvedValue({})
    jest.mocked(requestEmailChange).mockResolvedValue({})
    mockFetchUser.mockResolvedValue(undefined)
    mockResetCrispSessions.mockResolvedValue(undefined)
})

test('only the changed email is sent', async () => {
    renderWithIntl(<EmailSettings onSaved={mockSaved} />)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
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
    await waitFor(() => expect(mockSaved).toHaveBeenCalledTimes(1))
})

test('shows the committed replacement when the old native support session cannot reset', async () => {
    mockResetCrispSessions.mockRejectedValueOnce(new Error('native reset failed'))
    renderWithIntl(<EmailSettings onSaved={mockSaved} />)
    await change('Email for notifications', 'new@example.com')
    save()
    await verify()

    await waitFor(() => expect(mockResetCrispSessions).toHaveBeenCalledTimes(1))
    expect(mockInvalidateCrispToken).toHaveBeenCalledWith('test-user')
    expect(mockFetchUser).toHaveBeenCalledTimes(1)
    expect(mockSaved).toHaveBeenCalledTimes(1)
    expect(mockInvalidateCrispToken.mock.invocationCallOrder[0]).toBeLessThan(
        mockResetCrispSessions.mock.invocationCallOrder[0]
    )
})

test.each(['', 'invalid', 'a@'])('rejects invalid changed email %s inline', async (email) => {
    renderWithIntl(<EmailSettings onSaved={mockSaved} />)
    await change('Email for notifications', email)
    save()
    expect(await screen.findByText('Please enter a valid email address.')).toBeVisible()
    expect(updateUserById).not.toHaveBeenCalled()
})

test('email-only save does not require a missing name', async () => {
    mockUser!.user.fullName = ''
    renderWithIntl(<EmailSettings onSaved={mockSaved} />)
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

test('setting an email for the first time skips verification and sends only the email', async () => {
    mockUser!.user.email = ''
    renderWithIntl(<EmailSettings onSaved={mockSaved} />)

    expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument()
    await change('Email for notifications', 'new@example.com')
    save()

    await waitFor(() =>
        expect(updateUserById).toHaveBeenCalledWith({
            userId: 'test-user',
            email: 'new@example.com',
        })
    )
    expect(requestEmailChange).not.toHaveBeenCalled()
    expect(mockSaved).toHaveBeenCalledTimes(1)
})

test('shows server failures and retains edits without navigating', async () => {
    jest.mocked(updateUserById).mockResolvedValue({ error: 'Could not save your profile' })
    renderWithIntl(<EmailSettings onSaved={mockSaved} />)
    await change('Email for notifications', 'new@example.com')
    save()
    await verify()
    expect(await screen.findByText('Could not save your profile')).toBeVisible()
    expect(screen.getByLabelText('Email for notifications')).toHaveValue('new@example.com')
    expect(mockSaved).not.toHaveBeenCalled()
})

test('background refresh preserves edits and does not send an untouched stale name', async () => {
    const view = renderWithIntl(<EmailSettings onSaved={mockSaved} />)
    await change('Email for notifications', 'new@example.com')
    mockUser = { user: { ...mockUser!.user, fullName: 'New Verified Name' } }
    view.rerender(<EmailSettings onSaved={mockSaved} />)
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
    const view = renderWithIntl(<EmailSettings onSaved={mockSaved} />)
    expect(screen.getByLabelText('Email for notifications')).toBeDisabled()
    mockUser = user
    view.rerender(<EmailSettings onSaved={mockSaved} />)
    expect(screen.getByLabelText('Email for notifications')).toHaveValue('old@example.com')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})

test('an untouched email adopts the signup email from a late profile refresh without making it dirty', () => {
    mockUser!.user.email = ''
    const view = renderWithIntl(<EmailSettings onSaved={mockSaved} />)
    mockUser = { user: { ...mockUser!.user, email: 'signup@example.com' } }
    view.rerender(<EmailSettings onSaved={mockSaved} />)
    expect(screen.getByLabelText('Email for notifications')).toHaveValue('signup@example.com')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})

test('an email refresh preserves a replacement the user is editing', async () => {
    const view = renderWithIntl(<EmailSettings onSaved={mockSaved} />)
    await change('Email for notifications', 'replacement@example.com')
    mockUser = { user: { ...mockUser!.user, email: 'signup@example.com' } }
    view.rerender(<EmailSettings onSaved={mockSaved} />)
    expect(screen.getByLabelText('Email for notifications')).toHaveValue('replacement@example.com')
    expect(screen.getByRole('button', { name: 'Send code' })).toBeEnabled()
})

test('a duplicate email error is linked to its input and can be corrected', async () => {
    jest.mocked(requestEmailChange).mockResolvedValueOnce({
        error: 'This email is already associated with another account',
    })
    renderWithIntl(<EmailSettings onSaved={mockSaved} />)
    await change('Email for notifications', 'taken@example.com')
    save()
    expect(await screen.findByText('This email is already associated with another account.')).toBeVisible()
    expect(screen.getByLabelText('Email for notifications')).toHaveAccessibleDescription(
        'This email is already associated with another account.'
    )
    await change('Email for notifications', 'available@example.com')
    save()
    await verify()
    await waitFor(() => expect(mockSaved).toHaveBeenCalledTimes(1))
})

test.each(APP_LOCALES)('PROFILE_NAME_READ_ONLY is localized in the resolved %s catalog', async (locale) => {
    const messages = await loadMessages(locale)
    const expected = (
        messages as unknown as {
            profile: { edit: { errors: { nameReadOnly: string } } }
        }
    ).profile.edit.errors.nameReadOnly
    const serverCopy = 'Your name was not saved. Names are managed through identity verification.'
    expect(typeof expected).toBe('string')
    expect(expected.length).toBeGreaterThan(0)
    if (locale !== 'en') expect(expected).not.toBe(serverCopy)
    jest.mocked(updateUserById).mockResolvedValue({ error: serverCopy, code: 'PROFILE_NAME_READ_ONLY' })
    // A first email needs no verification step and exercises the shared save error.
    mockUser!.user.email = ''
    renderWithIntl(
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
            <EmailSettings onSaved={mockSaved} />
        </NextIntlClientProvider>
    )
    await act(async () => {
        fireEvent.change(screen.getByLabelText(messages.profile.edit.fields.email), {
            target: { value: 'new@example.com' },
        })
    })
    fireEvent.click(screen.getByRole('button', { name: messages.profile.edit.saveChanges }))
    expect(await screen.findByText(expected)).toBeVisible()
    expect(screen.queryByText('PROFILE_NAME_READ_ONLY')).not.toBeInTheDocument()
    if (locale !== 'en') expect(screen.queryByText(serverCopy)).not.toBeInTheDocument()
    expect(mockSaved).not.toHaveBeenCalled()
})
