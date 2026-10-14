/**
 * The arrival prompt's place in the Home modal chain (TASK-23251): below the
 * migration, push and post-signup prompts, above the balance warning.
 */
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import type { Arrival } from '../arrival.types'

let mockShowPermissionModal = false
jest.mock('@/hooks/useNotifications', () => ({
    useNotifications: () => ({ showPermissionModal: mockShowPermissionModal, oneSignalInitialized: false }),
    offerPushPrompt: jest.fn(),
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ isGetAppModalOpen: false, setIsGetAppModalOpen: jest.fn() }),
}))
// 1,000 USDC: above the balance-warning threshold
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ balance: 1_000_000_000n, isFetchingBalance: false }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
jest.mock('@/utils/general.utils', () => ({ getUserPreferences: () => undefined, updateUserPreferences: jest.fn() }))
let mockArrival: Arrival | null = null
jest.mock('../useArrivalPrompt', () => ({ useArrivalPrompt: () => ({ arrival: mockArrival, dismiss: jest.fn() }) }))

let mockMigrationVisible = false
jest.mock('@/components/Migration/MigrationDownloadModal', () => ({
    __esModule: true,
    default: ({ onVisibilityChange }: { onVisibilityChange: (visible: boolean) => void }) => {
        jest.requireActual<typeof React>('react').useEffect(() => onVisibilityChange(mockMigrationVisible), [])
        return null
    },
}))
let mockPostSignupVisible = false
jest.mock('@/components/Global/PostSignupActionManager', () => ({
    PostSignupActionManager: ({
        onActionModalVisibilityChange,
    }: {
        onActionModalVisibilityChange: (v: boolean) => void
    }) => {
        jest.requireActual<typeof React>('react').useEffect(
            () => onActionModalVisibilityChange(mockPostSignupVisible),
            []
        )
        return null
    },
}))
jest.mock('@/components/Notifications/SetupNotificationsModal', () => ({
    __esModule: true,
    default: () => <div>push-prompt</div>,
}))
jest.mock('@/components/Global/EarlyUserDrawer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Migration/ScanToDownloadModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/BalanceWarningDrawer', () => ({
    __esModule: true,
    default: ({ visible }: { visible: boolean }) => (visible ? <div>balance-warning</div> : null),
}))
jest.mock('../components/ArrivalDrawer', () => ({
    __esModule: true,
    default: ({ blocked }: { blocked: boolean }) => <div>{blocked ? 'arrival-waiting' : 'arrival-shown'}</div>,
}))

import { HomeModals } from '../components/HomeModals'

const IN_BRAZIL: Arrival = { userId: 'u1', country: 'BR', prompt: 'pix_br' }
const flush = () => act(async () => {})

beforeEach(() => {
    mockShowPermissionModal = false
    mockMigrationVisible = false
    mockPostSignupVisible = false
    mockArrival = IN_BRAZIL
})

it('shows the arrival prompt, and holds the balance warning while it is pending', async () => {
    render(<HomeModals />)
    await flush()
    expect(await screen.findByText('arrival-shown')).toBeInTheDocument()
    expect(screen.queryByText('balance-warning')).not.toBeInTheDocument()
})

it('lets the balance warning through once there is no arrival prompt', async () => {
    mockArrival = null
    render(<HomeModals />)
    await flush()
    expect(await screen.findByText('balance-warning')).toBeInTheDocument()
    expect(screen.queryByText(/arrival/)).not.toBeInTheDocument()
})

it.each([
    ['the push prompt', () => (mockShowPermissionModal = true)],
    ['the migration prompt', () => (mockMigrationVisible = true)],
    ['a post-signup prompt', () => (mockPostSignupVisible = true)],
])('waits while %s is up', async (_, setup) => {
    setup()
    render(<HomeModals />)
    await flush()
    expect(await screen.findByText('arrival-waiting')).toBeInTheDocument()
})
