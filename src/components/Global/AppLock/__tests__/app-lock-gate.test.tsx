// Regression tests for the AppLockGate decision flow. The critical invariant
// (D7): in guarded mode the gate locks from the storage mode ALONE — it must
// never wait for the user query, which cannot settle while its request is
// parked behind the lock. Getting that wrong is a permanent white screen.

import { render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import { AppLockGate } from '..'
import { getSessionMode, suspendAuthSession, unlockGuardedToken } from '@/utils/auth-token'
import { isCapacitor } from '@/utils/capacitor'

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(),
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: null,
        // never settles — the whole point: guarded mode must not depend on it
        isFetchingUser: true,
        logoutUser: jest.fn(),
    }),
}))

jest.mock('@/utils/auth-token', () => ({
    getSessionMode: jest.fn(),
    migratePlainToGuarded: jest.fn(async () => undefined),
    suspendAuthSession: jest.fn(),
    unlockGuardedToken: jest.fn(),
}))

jest.mock('@/utils/app-lock', () => ({
    LOCK_AFTER_BACKGROUND_MS: 5 * 60 * 1000,
    requestLocalUserPresence: jest.fn(),
}))

const mockIsCapacitor = isCapacitor as jest.MockedFunction<typeof isCapacitor>
const mockGetSessionMode = getSessionMode as jest.MockedFunction<typeof getSessionMode>
const mockSuspend = suspendAuthSession as jest.MockedFunction<typeof suspendAuthSession>
const mockUnlock = unlockGuardedToken as jest.MockedFunction<typeof unlockGuardedToken>

function renderGate() {
    return render(
        <NextIntlClientProvider locale="en" messages={en}>
            <AppLockGate>
                <div data-testid="protected">protected content</div>
            </AppLockGate>
        </NextIntlClientProvider>
    )
}

describe('AppLockGate', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders children directly on web', () => {
        mockIsCapacitor.mockReturnValue(false)
        renderGate()
        expect(screen.getByTestId('protected')).toBeInTheDocument()
        expect(mockGetSessionMode).not.toHaveBeenCalled()
    })

    it('guarded mode: locks and suspends the session without waiting for the user query (D7)', async () => {
        mockIsCapacitor.mockReturnValue(true)
        mockGetSessionMode.mockResolvedValue('guarded')
        // keep the auto-prompt pending so the locked UI stays put
        mockUnlock.mockReturnValue(new Promise(() => {}))

        renderGate()
        await waitFor(() => expect(screen.getByText(en.appLock.title)).toBeInTheDocument())
        expect(mockSuspend).toHaveBeenCalled()
        expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
    })

    it('guarded mode: opens after a successful unlock', async () => {
        mockIsCapacitor.mockReturnValue(true)
        mockGetSessionMode.mockResolvedValue('guarded')
        mockUnlock.mockResolvedValue('unlocked')

        renderGate()
        await waitFor(() => expect(screen.getByTestId('protected')).toBeInTheDocument())
    })

    it('guarded mode: stays locked when the prompt is cancelled', async () => {
        mockIsCapacitor.mockReturnValue(true)
        mockGetSessionMode.mockResolvedValue('guarded')
        mockUnlock.mockResolvedValue('cancelled')

        renderGate()
        await waitFor(() => expect(screen.getByText(en.appLock.promptFailed)).toBeInTheDocument())
        expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
    })

    it('none mode: nothing to protect, opens straight through', async () => {
        mockIsCapacitor.mockReturnValue(true)
        mockGetSessionMode.mockResolvedValue('none')

        renderGate()
        await waitFor(() => expect(screen.getByTestId('protected')).toBeInTheDocument())
        expect(mockSuspend).not.toHaveBeenCalled()
    })
})
