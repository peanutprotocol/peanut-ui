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
import { DOWNLOAD_PROMPT_SNOOZE_DAYS, MIGRATION_CUTOVER_DATE } from '@/constants/migration.consts'

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

// freeze "now" 30 days before the cutover so the notice-window cases don't
// start failing once the real calendar passes MIGRATION_CUTOVER_DATE
const DAY_MS = 24 * 60 * 60 * 1000
const FROZEN_NOW = MIGRATION_CUTOVER_DATE.getTime() - 30 * DAY_MS

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

let nowSpy: jest.SpyInstance<number, []>
beforeEach(() => {
    jest.clearAllMocks()
    mockFlagOn = false
    mockIsCapacitor = false
    mockGetPrefs.mockReturnValue(undefined)
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW)
})
afterEach(() => {
    nowSpy.mockRestore()
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
        mockGetPrefs.mockReturnValue({ migrationPromptSnoozedAt: new Date(FROZEN_NOW).toISOString() })
        const { unmount } = render(<MigrationDownloadModal />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        unmount()

        const justExpired = new Date(FROZEN_NOW - (DOWNLOAD_PROMPT_SNOOZE_DAYS + 1) * DAY_MS).toISOString()
        mockGetPrefs.mockReturnValue({ migrationPromptSnoozedAt: justExpired })
        render(<MigrationDownloadModal />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    it('stays hidden past the cutover (the sunset block owns that state)', () => {
        mockFlagOn = true
        nowSpy.mockReturnValue(MIGRATION_CUTOVER_DATE.getTime() + 1000)
        render(<MigrationDownloadModal />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
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
