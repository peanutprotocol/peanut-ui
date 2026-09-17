/**
 * Recovery paths of the forced-update screen: a staged bundle restarts through
 * the OTA context (with its applying / failed / manual-restart states kept), a
 * store-only verdict opens the store, an empty updater asks Capgo and falls
 * back to the store, and web reloads. Nothing on it dismisses, and nothing on
 * it unlocks — only the next policy check can.
 */
import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { STORE_URL } from '@/constants/migration.consts'
import type { OtaApplyState } from '@/context/OtaUpdateContext'
import type { OtaCheckOutcome } from '@/utils/capgo-updater'

const platform = { current: 'android-native' as 'web' | 'ios-pwa' | 'android-native' | 'ios-native' }
const openExternalUrl = jest.fn<void, [string]>()
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: () => false,
    getPlatform: () => platform.current,
    openExternalUrl: (url: string) => openExternalUrl(url),
}))
const standalone = { pwa: false }
const purgeCaches = jest.fn<Promise<void>, [readonly string[]]>(async () => {})
jest.mock('@/utils/cache.utils', () => ({
    isStandalonePwa: () => standalone.pwa,
    purgeCaches: (patterns: readonly string[]) => purgeCaches(patterns),
}))
const ota = {
    pendingBundle: null as { id: string; version: string } | null,
    storeUpdateRequired: false,
    applyState: 'idle' as OtaApplyState,
    applyNow: jest.fn(async () => {}),
    checkNow: jest.fn<Promise<OtaCheckOutcome | 'unavailable'>, []>(),
}
jest.mock('@/context/OtaUpdateContext', () => ({ useOtaUpdate: () => ota }))

import { RequiredUpdateScreen } from '../RequiredUpdateScreen'

beforeEach(() => {
    platform.current = 'android-native'
    standalone.pwa = false
    ota.pendingBundle = null
    ota.storeUpdateRequired = false
    ota.applyState = 'idle'
    ota.applyNow.mockClear()
    ota.checkNow.mockReset().mockResolvedValue('unavailable')
    openExternalUrl.mockClear()
    purgeCaches.mockClear()
})

it('offers no dismissal on any platform', () => {
    for (const current of ['web', 'android-native'] as const) {
        platform.current = current
        const { unmount } = renderWithIntl(<RequiredUpdateScreen />)
        expect(screen.queryByRole('button', { name: /not now|close|got it|continue anyway/i })).not.toBeInTheDocument()
        unmount()
    }
})

describe('native with a staged bundle', () => {
    beforeEach(() => {
        ota.pendingBundle = { id: 'b-2', version: '1.2.0' }
    })

    it('restarts onto it through the OTA context', () => {
        renderWithIntl(<RequiredUpdateScreen />)
        fireEvent.click(screen.getByRole('button', { name: 'Restart now' }))
        expect(ota.applyNow).toHaveBeenCalledTimes(1)
        expect(ota.checkNow).not.toHaveBeenCalled()
    })

    it('locks the CTA while applying', () => {
        ota.applyState = 'applying'
        renderWithIntl(<RequiredUpdateScreen />)
        // the spinner's sr-only text joins the accessible name while loading
        expect(screen.getByRole('button', { name: /Restart now/ })).toBeDisabled()
    })

    it('comes back retriable after a failed apply, with the failure copy', () => {
        ota.applyState = 'failed'
        renderWithIntl(<RequiredUpdateScreen />)
        expect(screen.getByText(/couldn't be applied/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(ota.applyNow).toHaveBeenCalledTimes(1)
    })

    it('shows the close-and-reopen instruction once the plugin owns the restart', () => {
        ota.applyState = 'manual-restart'
        renderWithIntl(<RequiredUpdateScreen />)
        expect(screen.getByText(/Close Peanut from the app switcher/)).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('stays up after the restart call returns: only a policy verdict can unlock', async () => {
        renderWithIntl(<RequiredUpdateScreen />)
        fireEvent.click(screen.getByRole('button', { name: 'Restart now' }))
        await waitFor(() => expect(ota.applyNow).toHaveBeenCalled())
        expect(screen.getByText('Update Peanut to continue')).toBeInTheDocument()
    })
})

describe('native without a staged bundle', () => {
    it('asks the updater for one and then offers the restart it staged', async () => {
        ota.checkNow.mockImplementation(async () => {
            ota.pendingBundle = { id: 'b-3', version: '1.3.0' }
            return 'staged'
        })
        const { rerender } = renderWithIntl(<RequiredUpdateScreen />)
        fireEvent.click(screen.getByRole('button', { name: 'Check for update' }))
        await waitFor(() => expect(ota.checkNow).toHaveBeenCalledTimes(1))
        rerender(<RequiredUpdateScreen />)
        expect(screen.getByRole('button', { name: 'Restart now' })).toBeInTheDocument()
    })

    it.each(['up-to-date', 'unavailable'] as const)(
        'falls back to the store when the check comes back %s, and stays retriable',
        async (outcome) => {
            ota.checkNow.mockResolvedValue(outcome)
            renderWithIntl(<RequiredUpdateScreen />)
            fireEvent.click(screen.getByRole('button', { name: 'Check for update' }))
            await screen.findByText(/No update is available in the app yet/)
            fireEvent.click(screen.getByRole('button', { name: 'Open Google Play' }))
            expect(openExternalUrl).toHaveBeenCalledWith(STORE_URL.android)
            expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
        }
    )

    it('reports a failed check and keeps both the retry and the store', async () => {
        ota.checkNow.mockResolvedValue('failed')
        renderWithIntl(<RequiredUpdateScreen />)
        fireEvent.click(screen.getByRole('button', { name: 'Check for update' }))
        await screen.findByText(/Couldn't check for the update/)
        expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Open Google Play' })).toBeInTheDocument()
    })
})

it('sends a store-only verdict to the store for its platform', () => {
    platform.current = 'ios-native'
    ota.storeUpdateRequired = true
    ota.pendingBundle = { id: 'b-2', version: '1.2.0' }
    renderWithIntl(<RequiredUpdateScreen />)
    expect(screen.queryByRole('button', { name: 'Restart now' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open App Store' }))
    expect(openExternalUrl).toHaveBeenCalledWith(STORE_URL.ios)
})

describe('web and PWA', () => {
    const location = window.location
    let reload: jest.Mock
    let replace: jest.Mock
    beforeEach(() => {
        reload = jest.fn()
        replace = jest.fn()
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...location, href: 'https://peanut.me/home', reload, replace },
        })
    })
    afterEach(() => {
        Object.defineProperty(window, 'location', { configurable: true, value: location })
    })

    it('reloads the document after dropping the worker document caches, only on a tap', async () => {
        platform.current = 'web'
        renderWithIntl(<RequiredUpdateScreen />)
        expect(reload).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Reload Peanut' }))
        await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
        expect(purgeCaches).toHaveBeenCalledTimes(1)
        expect(ota.applyNow).not.toHaveBeenCalled()
    })

    it('keeps an installed PWA in its own window', async () => {
        platform.current = 'ios-pwa'
        standalone.pwa = true
        renderWithIntl(<RequiredUpdateScreen />)
        fireEvent.click(screen.getByRole('button', { name: 'Reload Peanut' }))
        await waitFor(() => expect(replace).toHaveBeenCalledWith('https://peanut.me/home'))
        expect(reload).not.toHaveBeenCalled()
    })
})
