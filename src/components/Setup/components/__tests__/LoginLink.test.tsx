import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginLink from '@/components/Setup/components/LoginLink'

// useLogin — mutable handler + flag so each test drives success/failure/loading.
let mockHandleLoginClick = jest.fn()
let mockIsLoggingIn = false
jest.mock('@/hooks/useLogin', () => ({
    useLogin: () => ({ handleLoginClick: mockHandleLoginClick, isLoggingIn: mockIsLoggingIn }),
}))

const mockToastError = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ error: mockToastError }),
}))

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))

import posthog from 'posthog-js'
const captureMock = (posthog as unknown as { capture: jest.Mock }).capture

beforeEach(() => {
    jest.clearAllMocks()
    mockHandleLoginClick = jest.fn()
    mockIsLoggingIn = false
})

describe('LoginLink', () => {
    it('triggers login on click', () => {
        render(<LoginLink />)
        fireEvent.click(screen.getByRole('button', { name: /log in/i }))
        expect(mockHandleLoginClick).toHaveBeenCalledTimes(1)
    })

    it('surfaces a friendly toast + analytics on a login failure', async () => {
        mockHandleLoginClick = jest.fn().mockRejectedValue({ code: 'LOGIN_CANCELED' })
        render(<LoginLink />)
        fireEvent.click(screen.getByRole('button', { name: /log in/i }))
        await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Login was canceled. Please try again.'))
        expect(captureMock).toHaveBeenCalledWith('signup_login_error', { error_code: 'LOGIN_CANCELED' })
    })

    it('disables the button while logging in', () => {
        mockIsLoggingIn = true
        render(<LoginLink />)
        expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled()
    })
})
