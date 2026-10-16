import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { classifyPasskeyError } from '@/utils/webauthn.utils'
import GuestLoginModal from '..'

const mockLogin = jest.fn()
const mockClose = jest.fn()
const mockToastError = jest.fn()

jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleLogin: mockLogin, isLoggingIn: false }),
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ isSignInModalOpen: true, setIsSignInModalOpen: mockClose }),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ error: mockToastError }),
}))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ ctas }: { ctas: { text: string; onClick: () => void }[] }) => (
        <button onClick={ctas[0].onClick}>{ctas[0].text}</button>
    ),
}))

beforeEach(() => jest.clearAllMocks())

test.each([
    [
        'The operation couldn’t be completed. Device must be unlocked to perform request.',
        'Unlock the device, then try again.',
    ],
    [
        'Unable to verify webcredentials association of visual-only.app with domain peanut.me',
        'Passkey verification is temporarily unavailable. Wait a few seconds and try again.',
    ],
    [
        'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)',
        'Passkey verification wasn’t completed. Try again when ready.',
    ],
])('keeps actionable recovery from the owning login catch: %s', async (message, recovery) => {
    const classification = classifyPasskeyError(new DOMException(message, 'NotAllowedError'))
    mockLogin.mockRejectedValue(
        Object.assign(new Error(classification.message), { name: 'PasskeyError', code: classification.code })
    )
    renderWithIntl(<GuestLoginModal />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(recovery))
    expect(mockLogin).toHaveBeenCalledTimes(1)
    expect(mockClose).not.toHaveBeenCalled()
})

test('uses localized generic copy for an unknown login failure without exposing its payload', async () => {
    mockLogin.mockRejectedValue(new Error('private backend payload'))
    renderWithIntl(<GuestLoginModal />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Error logging in'))
    expect(mockClose).not.toHaveBeenCalled()
})

test('closes only after successful verification', async () => {
    mockLogin.mockResolvedValue(undefined)
    renderWithIntl(<GuestLoginModal />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(mockClose).toHaveBeenCalledWith(false))
    expect(mockToastError).not.toHaveBeenCalled()
})
