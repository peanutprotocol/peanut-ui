jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * PendingVerificationTasks — the Home card mirroring Bridge's "additional
 * verification needed" dashboard state.
 *
 * Reads top-level capability nextActions (not rail gates) so it catches both
 * blocking tasks and advisory orphans (future-dated tasks on fully-enabled
 * users, which no rail references). accept-tos routes into the existing
 * BridgeTosStep (its compliance.bridge.xyz link frames fine); bridge-hosted
 * routes to the additional-verification screen, which owns the prep copy and
 * the handoff to Persona (see AdditionalVerificationView). The ToS modal is
 * snapshotted at tap time so it survives the task list flapping under the ~4s
 * user auto-refresh.
 */
import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import type { NextAction, RailCapability } from '@/types/capabilities'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'

let mockNextActions: NextAction[] = []
let mockRails: RailCapability[] = []
const mockFetchUser = jest.fn(() => Promise.resolve(null))
let mockStoredDismissal: string[] | undefined
const mockUpdatePreferences = jest.fn()
const mockCapabilities = () => {
    const capabilities = withFeatureReport({ rails: mockRails, nextActions: mockNextActions })
    capabilities.features!.bank.accounts = Object.fromEntries(
        mockNextActions.map((action, index) => [
            ['USD', 'EUR', 'GBP', 'MXN'][index],
            { state: action.effectiveDate ? 'on' : 'action_required', action: action.key },
        ])
    )
    return capabilities
}

jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ nextActions: mockNextActions, rails: mockRails, capabilities: mockCapabilities() }),
}))
let mockUserId = 'user-1'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: mockUserId } }, fetchUser: mockFetchUser }),
}))
jest.mock('@/utils/general.utils', () => ({
    getUserPreferences: () => ({ pendingVerificationTasksDismissed: mockStoredDismissal }),
    updateUserPreferences: (userId: string, prefs: Record<string, unknown>) => {
        mockStoredDismissal = prefs.pendingVerificationTasksDismissed as string[]
        mockUpdatePreferences(userId, prefs)
    },
}))
jest.mock('@/components/Kyc/BridgeTosStep', () => ({
    BridgeTosStep: (props: { visible: boolean }) => (props.visible ? <div data-testid="tos-step" /> : null),
}))
jest.mock('@/utils/capacitor', () => ({
    isNativeBridge: () => false,
    // mobile-release's mascot picker + useAppHaptic call these
    isAndroidNative: () => false,
    isCapacitor: () => false,
}))
const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush }),
}))
const mockHandleSelfHealResubmit = jest.fn()
let mockKycFlow: { isLoading: boolean; error: string | null; handleSelfHealResubmit: jest.Mock }
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => mockKycFlow,
}))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({
    SumsubKycModals: () => null,
}))
const mockTrackUpliftStarted = jest.fn()
jest.mock('@/hooks/useEeaUpliftFunnel', () => ({
    useEeaUpliftFunnel: () => ({ trackStarted: mockTrackUpliftStarted, trackCompleted: jest.fn(), reset: jest.fn() }),
}))
const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const tosAction: NextAction = { key: 'accept-tos', kind: 'accept-tos', purpose: 'accept-bridge-tos' }

const mockBumpEpoch = jest.fn()
jest.mock('@/features/attention/journeyEpoch', () => ({ bumpJourneyEpoch: () => mockBumpEpoch() }))
import { visibleHomeTasks } from '@/features/attention/taskVisibility'
import VerificationDueSurface from '@/features/attention/surfaces/zone/VerificationDueSurface'
import { selectHomeTasks } from '@/utils/bridge-tasks.utils'
import { verificationDue } from '@/features/attention/registry'
import type { JourneyState } from '@/features/attention/types'
test('closing the last advisory task releases its manager slot without dismissing future tasks', () => {
    mockNextActions = [{ ...tosAction, effectiveDate: daysFromNow(20) }]
    mockKycFlow = { isLoading: false, error: null, handleSelfHealResubmit: mockHandleSelfHealResubmit }
    const onDismissed = jest.fn()
    const { container } = render(
        <VerificationDueSurface
            askId="verification-due"
            mode="ask"
            onActed={jest.fn()}
            onDismissed={onDismissed}
            onSnoozed={jest.fn()}
        />
    )
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(container).toBeEmptyDOMElement()
    expect(mockUpdatePreferences).toHaveBeenCalled()
    const state = {
        userId: 'user-1',
        userLoaded: true,
        dueTasks: visibleHomeTasks(
            selectHomeTasks(mockNextActions, mockCapabilities().features).largeTasks,
            mockStoredDismissal
        ).length,
    } as JourneyState
    expect(verificationDue.eligible(state)).toBe('ineligible')
    expect(mockBumpEpoch).toHaveBeenCalled()
    expect(onDismissed).not.toHaveBeenCalled()
})
