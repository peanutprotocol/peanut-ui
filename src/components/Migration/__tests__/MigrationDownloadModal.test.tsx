/** @jest-environment jsdom */
/**
 * MigrationDownloadModal — the pwa-sunset "The Peanut app is here" prompt.
 *
 * Gating contract: flag ON + logged-in web user + snooze expired. Flag OFF
 * must render nothing. The web app stays available, so there is no deadline.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { DOWNLOAD_PROMPT_SNOOZE_DAYS } from '@/constants/migration.consts'

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

// the day the old date-based web shutdown went live by mistake: the prompt
// must still show, with no deadline in its copy
const DAY_MS = 24 * 60 * 60 * 1000
const FROZEN_NOW = new Date('2026-10-09T12:00:00Z').getTime()

let mockFlagOn = false
jest.mock('@/hooks/useMigrationFlag', () => ({
    useMigrationFlag: () => mockFlagOn,
}))

let mockIsCapacitor = false
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockIsCapacitor,
    // mobile-release's mascot picker calls this at module scope
    isAndroidNative: () => false,
    openExternalUrl: jest.fn(),
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-1' } } }),
}))

const mockGetPrefs = jest.fn()
const mockUpdatePrefs = jest.fn()
jest.mock('@/utils/general.utils', () => ({
    getUserPreferences: (...args: unknown[]) => mockGetPrefs(...args),
    updateUserPreferences: (...args: unknown[]) => mockUpdatePrefs(...args),
}))

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

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
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows for a logged-in web user', () => {
        mockFlagOn = true
        render(<MigrationDownloadModal />)
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('stays hidden inside the native app', () => {
        mockFlagOn = true
        mockIsCapacitor = true
        render(<MigrationDownloadModal />)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('stays hidden while a recent snooze is active, reappears after it expires', () => {
        mockFlagOn = true
        mockGetPrefs.mockReturnValue({ migrationPromptSnoozedAt: new Date(FROZEN_NOW).toISOString() })
        const { unmount } = render(<MigrationDownloadModal />)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        unmount()

        const justExpired = new Date(FROZEN_NOW - (DOWNLOAD_PROMPT_SNOOZE_DAYS + 1) * DAY_MS).toISOString()
        mockGetPrefs.mockReturnValue({ migrationPromptSnoozedAt: justExpired })
        render(<MigrationDownloadModal />)
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('shows the app copy with no deadline', () => {
        mockFlagOn = true
        render(<MigrationDownloadModal />)
        expect(screen.getByText('The Peanut app is here!')).toBeInTheDocument()
        expect(screen.queryByText(/\bdays?\b/i)).not.toBeInTheDocument()
    })

    it('remind-me-later snoozes and reports visibility', async () => {
        mockFlagOn = true
        const onVisibilityChange = jest.fn()
        render(<MigrationDownloadModal onVisibilityChange={onVisibilityChange} />)
        expect(onVisibilityChange).toHaveBeenLastCalledWith(true)

        fireEvent.click(screen.getByRole('button', { name: /later/i }))
        // headlessui keeps the closing dialog mounted through its leave transition
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(mockUpdatePrefs).toHaveBeenCalledWith('user-1', {
            migrationPromptSnoozedAt: expect.any(String),
        })
        expect(onVisibilityChange).toHaveBeenLastCalledWith(false)
    })
})
