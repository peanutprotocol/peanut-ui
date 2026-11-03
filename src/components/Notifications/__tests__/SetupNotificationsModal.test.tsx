import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { clearAuthToken, setAuthToken } from '@/utils/auth-token'
import SetupNotificationsModal from '../SetupNotificationsModal'

const mockAuthReady = jest.fn(async () => {})
jest.mock('@/utils/auth-token', () => ({
    ...jest.requireActual('@/utils/auth-token'),
    authReady: () => mockAuthReady(),
}))
const mockPermission = jest.fn<Promise<string>, []>()
const mockAfterPermission = jest.fn<Promise<void>, []>()
const mockSave = jest.fn()
const mockClose = jest.fn()
const mockToast = jest.fn()
let mockUserId = 'user-a'
jest.mock('@/context/authContext', () => ({ useOptionalAuth: () => ({ user: { user: { userId: mockUserId } } }) }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToast }) }))
jest.mock('@/utils/general.utils', () => ({ updateUserPreferences: jest.fn() }))
jest.mock('@/hooks/useNotifications', () => ({
    useNotifications: () => ({
        showPermissionModal: true,
        promptTrigger: null,
        requestPermission: mockPermission,
        afterPermissionAttempt: mockAfterPermission,
        closePermissionModal: mockClose,
        isRequestingPermission: false,
    }),
}))
jest.mock('@/services/notifications', () => ({
    ...jest.requireActual('@/services/notifications'),
    notificationsApi: { savePreferences: (...args: unknown[]) => mockSave(...args) },
}))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ visible, ctas }: { visible: boolean; ctas: { onClick: () => void }[] }) =>
        visible ? <button onClick={ctas[0].onClick}>allow notifications</button> : null,
}))
const jwt = (userId: string) => `x.${btoa(JSON.stringify({ userId }))}.y`
beforeEach(() => {
    jest.clearAllMocks()
    mockAuthReady.mockReset().mockResolvedValue(undefined)
    mockUserId = 'user-a'
    setAuthToken(jwt('user-a'))
    mockPermission.mockReset().mockResolvedValue('granted')
    mockAfterPermission.mockReset().mockResolvedValue(undefined)
    mockSave.mockReset().mockResolvedValue({ push: true })
})

it('the same session completes with an expectedUserId-bound preference save', async () => {
    renderWithIntl(<SetupNotificationsModal />)
    fireEvent.click(screen.getByRole('button', { name: 'allow notifications' }))
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ push: true }), 'user-a'))
})

it.each(['changed', 'cleared', 'unmounted'] as const)(
    'permission resolution after the session is %s cannot save',
    async (state) => {
        let finish!: (permission: string) => void
        mockPermission.mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve
            })
        )
        const view = renderWithIntl(<SetupNotificationsModal />)
        fireEvent.click(screen.getByRole('button', { name: 'allow notifications' }))
        expect(mockPermission).toHaveBeenCalledTimes(1)
        if (state === 'changed') setAuthToken(jwt('user-b'))
        if (state === 'cleared')
            await act(async () => {
                await clearAuthToken()
            })
        if (state === 'unmounted') view.unmount()
        await act(async () => finish('granted'))
        expect(mockSave).not.toHaveBeenCalled()
    }
)

it('rechecks identity after post-permission reconciliation before saving', async () => {
    let finish!: () => void
    mockAfterPermission.mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve
        })
    )
    renderWithIntl(<SetupNotificationsModal />)
    fireEvent.click(screen.getByRole('button', { name: 'allow notifications' }))
    await waitFor(() => expect(mockAfterPermission).toHaveBeenCalledTimes(1))
    setAuthToken(jwt('user-b'))
    await act(async () => finish())
    expect(mockSave).not.toHaveBeenCalled()
})

it('R18 duplicate taps during hydration ask permission and save only once', async () => {
    await clearAuthToken()
    let finish!: () => void
    mockAuthReady.mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve
        })
    )
    renderWithIntl(<SetupNotificationsModal />)
    fireEvent.click(screen.getByRole('button', { name: 'allow notifications' }))
    fireEvent.click(screen.getByRole('button', { name: 'allow notifications' }))
    expect(mockPermission).not.toHaveBeenCalled()
    expect(mockSave).not.toHaveBeenCalled()
    await act(async () => {
        setAuthToken(jwt('user-a'))
        finish()
    })
    expect(mockPermission).toHaveBeenCalledTimes(1)
    expect(mockSave).toHaveBeenCalledTimes(1)
})
