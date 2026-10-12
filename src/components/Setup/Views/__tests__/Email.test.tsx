/** @jest-environment jsdom */
/**
 * Email step — the required notification email during sign-up.
 *
 * Contract under test: a failed save shows saveFailed and keeps Continue
 * usable so the next press retries; a duplicate shows its own copy; a
 * navigation failure after a confirmed save is reported, not shown as a
 * failed save.
 */
import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import EmailStep from '@/components/Setup/Views/Email'
import { updateUserById } from '@/app/actions/users'
import { captureException } from '@/utils/sentry-lazy'

const mockHandleNext = jest.fn()
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockHandleNext }) }))
jest.mock('@/features/setup/SetupFlowContext', () => ({
    useSetupFlowContext: () => ({ notificationEmail: '', setNotificationEmail: jest.fn(), setIsLoading: jest.fn() }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'u1', email: null } }, fetchUser: jest.fn(async () => {}) }),
}))
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ setQueryData: jest.fn() }) }))
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn() }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))
jest.mock('../../components/SetupDocsDrawer', () => ({
    SetupDocLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

const mockUpdate = updateUserById as jest.MockedFunction<typeof updateUserById>
const copy = en.setup.email

const submit = (value = 'ana@example.com') => {
    fireEvent.change(screen.getByPlaceholderText(copy.placeholder), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: copy.continue }))
}

beforeEach(() => {
    jest.clearAllMocks()
    mockHandleNext.mockResolvedValue(undefined)
})

it('shows saveFailed on a network failure, keeps Continue usable, and retries on the next press', async () => {
    mockUpdate
        .mockResolvedValueOnce({ error: 'Something went wrong. Please try again.' })
        .mockResolvedValueOnce({ data: {} as never })
    renderWithIntl(<EmailStep />)

    submit()
    expect(await screen.findByText(copy.saveFailed)).toBeTruthy()
    expect(mockHandleNext).not.toHaveBeenCalled()
    const button = screen.getByRole('button', { name: copy.continue }) as HTMLButtonElement
    await waitFor(() => expect(button.disabled).toBe(false))

    fireEvent.click(button)
    await waitFor(() => expect(mockHandleNext).toHaveBeenCalledTimes(1))
    expect(mockUpdate).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(copy.saveFailed)).toBeNull()
})

it('shows the duplicate copy for an email used by another account', async () => {
    mockUpdate.mockResolvedValueOnce({ error: 'This email is already associated with another account' })
    renderWithIntl(<EmailStep />)

    submit()
    expect(await screen.findByText(copy.alreadyRegistered)).toBeTruthy()
    expect(mockHandleNext).not.toHaveBeenCalled()
})

it('reports a navigation failure after a confirmed save without showing saveFailed', async () => {
    const navigationError = new Error('stepper failed')
    mockUpdate.mockResolvedValueOnce({ data: {} as never })
    mockHandleNext.mockRejectedValueOnce(navigationError)
    renderWithIntl(<EmailStep />)

    submit()
    await waitFor(() => expect(captureException).toHaveBeenCalledWith(navigationError))
    expect(screen.queryByText(copy.saveFailed)).toBeNull()
    await waitFor(() =>
        expect((screen.getByRole('button', { name: copy.continue }) as HTMLButtonElement).disabled).toBe(false)
    )
})
