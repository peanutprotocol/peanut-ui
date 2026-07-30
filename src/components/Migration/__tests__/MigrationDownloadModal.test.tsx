/** @jest-environment jsdom */
/**
 * MigrationDownloadModal — the pwa-sunset "Peanut is becoming an app" prompt.
 *
 * Gating contract: flag ON + logged-in web user + before the cutover + snooze
 * expired. Flag OFF (today's default) must render nothing — the key
 * flag-off-regression check for the migration PR.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { MIGRATION_CUTOVER_DATE } from '@/constants/migration.consts'

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

let mockFlagOn = false
jest.mock('@/hooks/useMigrationFlag', () => ({
    useMigrationFlag: () => mockFlagOn,
}))

let mockIsCapacitor = false
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockIsCapacitor,
    openExternalUrl: jest.fn(),
}))

jest.mock('@/redux/hooks', () => ({
    useUserStore: () => ({ user: { user: { userId: 'user-1' } } }),
}))

const mockGetPrefs = jest.fn()
const mockUpdatePrefs = jest.fn()
jest.mock('@/utils/general.utils', () => ({
    getUserPreferences: (...args: unknown[]) => mockGetPrefs(...args),
    updateUserPreferences: (...args: unknown[]) => mockUpdatePrefs(...args),
}))

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: (props: { visible: boolean; title?: string; footer?: React.ReactNode }) =>
        props.visible ? (
            <div data-testid="modal">
                <h3>{props.title}</h3>
                {props.footer}
            </div>
        ) : null,
}))

import MigrationDownloadModal from '../MigrationDownloadModal'

beforeEach(() => {
    jest.clearAllMocks()
    mockFlagOn = false
    mockIsCapacitor = false
    mockGetPrefs.mockReturnValue(undefined)
})

describe('MigrationDownloadModal', () => {
    it('renders nothing while the pwa-sunset flag is off', () => {
        render(<MigrationDownloadModal />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    it('shows for a logged-in web user during the notice window', () => {
        mockFlagOn = true
        render(<MigrationDownloadModal />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    it('stays hidden inside the native app', () => {
        mockFlagOn = true
        mockIsCapacitor = true
        render(<MigrationDownloadModal />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    it('stays hidden while a recent snooze is active, reappears after it expires', () => {
        mockFlagOn = true
        mockGetPrefs.mockReturnValue({ migrationPromptSnoozedAt: new Date().toISOString() })
        const { unmount } = render(<MigrationDownloadModal />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        unmount()

        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
        mockGetPrefs.mockReturnValue({ migrationPromptSnoozedAt: tenDaysAgo })
        render(<MigrationDownloadModal />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    it('stays hidden past the cutover (the sunset block owns that state)', () => {
        mockFlagOn = true
        const afterCutover = MIGRATION_CUTOVER_DATE.getTime() + 1000
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(afterCutover)
        render(<MigrationDownloadModal />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        nowSpy.mockRestore()
    })

    it('remind-me-later snoozes and reports visibility', () => {
        mockFlagOn = true
        const onVisibilityChange = jest.fn()
        render(<MigrationDownloadModal onVisibilityChange={onVisibilityChange} />)
        expect(onVisibilityChange).toHaveBeenLastCalledWith(true)

        fireEvent.click(screen.getByRole('button'))
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockUpdatePrefs).toHaveBeenCalledWith('user-1', {
            migrationPromptSnoozedAt: expect.any(String),
        })
        expect(onVisibilityChange).toHaveBeenLastCalledWith(false)
    })
})
