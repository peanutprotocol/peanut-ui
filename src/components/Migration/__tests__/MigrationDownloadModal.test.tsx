/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
jest.mock('@/features/attention/ledgerSync', () => ({ scheduleLedgerSync: jest.fn() }))
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import MigrationDownloadModal from '../MigrationDownloadModal'
import { run } from '@/features/attention/__tests__/legacy-manager.fixture'
import type { Ledger } from '@/features/attention/types'
import { ledgerActions, readLedger, resetLedgerMemoryForTests } from '@/features/attention/ledger'

// The manager owns visibility and snooze. These scenarios follow the accepted
// Attention policy in PR #3667, rather than the former self-opening component.
const now = Date.parse('2026-10-12T12:00:00Z')
const web = { isNative: false, migration: { on: true }, now } as const
const props = () => ({
    askId: 'install-app' as const,
    presentation: 'modal' as const,
    onActed: jest.fn(),
    onDismissed: jest.fn(),
    onSnoozed: jest.fn(),
})
beforeEach(() => {
    window.localStorage.clear()
    resetLedgerMemoryForTests()
})
function renderWhenPicked(patch: Parameters<typeof run>[0], ledger: Ledger = {}) {
    const pick = run({ ...web, ...patch }, {}, ledger).interrupt
    const surface = props()
    const view = render(pick === 'install-app' ? <MigrationDownloadModal {...surface} /> : <></>, {
        wrapper: IntlWrapper,
    })
    return { ...view, surface, pick }
}

describe('MigrationDownloadModal under the attention manager', () => {
    it('renders nothing where the prompt is off (another dev fixture is running)', () => {
        renderWhenPicked({ migration: { on: false } })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    it('shows for a logged-in web user', () => {
        renderWhenPicked({})
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    it('stays hidden inside the native app', () => {
        renderWhenPicked({ isNative: true })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    it('stays hidden while a recent snooze is active, and reappears after it expires', () => {
        const until = new Date(now + 86400000).toISOString()
        const first = renderWhenPicked({}, { 'install-app': { snoozedUntil: until } })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        first.unmount()
        renderWhenPicked({}, { 'install-app': { snoozedUntil: new Date(now - 1).toISOString() } })
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    it('shows the app copy with no deadline', () => {
        renderWhenPicked({})
        expect(screen.getByText('The Peanut app is here!')).toBeInTheDocument()
        expect(screen.queryByText(/\bdays?\b/i)).not.toBeInTheDocument()
    })
    it('remind-me-later reports a snooze to the manager and the snoozed prompt is hidden', () => {
        const surface = props()
        surface.onSnoozed.mockImplementation(() => ledgerActions.snoozed('user-a', 'install-app', now + 3 * 86400000))
        const first = render(<MigrationDownloadModal {...surface} />, { wrapper: IntlWrapper })
        fireEvent.click(screen.getByRole('button', { name: /later/i }))
        expect(surface.onSnoozed).toHaveBeenCalledTimes(1)
        const ledger = readLedger('user-a')
        expect(ledger['install-app']?.snoozedUntil).toBe(new Date(now + 3 * 86400000).toISOString())
        first.unmount()
        renderWhenPicked({}, ledger)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})

describe('downloadPromptAllowedByFixture', () => {
    const allowedUnder = (fixture: string | null) => {
        window.sessionStorage.clear()
        window.history.replaceState({}, '', fixture ? `/home?__fixture=${fixture}` : '/home')
        let allowed: boolean | undefined
        jest.isolateModules(() => {
            jest.doMock('@/constants/dev-tools.consts', () => ({ DEV_TOOLS_ENABLED: true }))
            allowed = require('@/dev/fixtures/active').downloadPromptAllowedByFixture()
        })
        return allowed
    }
    afterEach(() => window.history.replaceState({}, '', '/'))

    it('hides the prompt under another fixture, so it does not cover the drawer the fixture shows', () => {
        expect(allowedUnder('early-user')).toBe(false)
    })
    it('shows the prompt under its own capture fixture', () => {
        expect(allowedUnder('download-prompt')).toBe(true)
    })
    it('shows the prompt with no fixture', () => {
        expect(allowedUnder(null)).toBe(true)
    })
})
