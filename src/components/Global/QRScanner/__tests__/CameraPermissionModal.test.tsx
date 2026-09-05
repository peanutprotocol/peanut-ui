/** @jest-environment jsdom */
/**
 * Native has no browser chrome, so the per-browser screenshot carousel — which
 * teaches the user to change a *site* permission — is wrong there: the camera
 * grant is an OS permission on the app. These pin the split.
 */
import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { isAndroidNativeBridge, isNativeBridge } from '@/utils/capacitor'
import { canOpenAppSettings, openAppSettings } from '@/utils/native-settings'
import { DeviceType } from '@/hooks/useGetDeviceType'
import { BrowserType } from '@/hooks/useGetBrowserType'
import CameraPermissionModal from '../CameraPermissionModal'

jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isNativeBridge: jest.fn(),
    isAndroidNativeBridge: jest.fn(),
}))
jest.mock('@/utils/native-settings', () => ({
    canOpenAppSettings: jest.fn(),
    openAppSettings: jest.fn().mockResolvedValue(true),
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: { alt?: string }) => <img alt={props.alt ?? ''} />,
}))

const deviceType = { current: DeviceType.IOS }
jest.mock('@/hooks/useGetDeviceType', () => ({
    ...jest.requireActual('@/hooks/useGetDeviceType'),
    useDeviceType: () => ({ deviceType: deviceType.current }),
}))
jest.mock('@/hooks/useGetBrowserType', () => ({
    ...jest.requireActual('@/hooks/useGetBrowserType'),
    useGetBrowserType: () => ({ browserType: BrowserType.SAFARI }),
}))

const appStateListener = { current: null as ((state: { isActive: boolean }) => void) | null }
const removeListener = jest.fn()
jest.mock('@capacitor/app', () => ({
    App: {
        addListener: (_event: string, fn: (state: { isActive: boolean }) => void) => {
            appStateListener.current = fn
            return Promise.resolve({ remove: removeListener })
        },
    },
}))

const mockedIsNativeBridge = isNativeBridge as jest.Mock
const mockedIsAndroidNativeBridge = isAndroidNativeBridge as jest.Mock
const mockedCanOpenAppSettings = canOpenAppSettings as jest.Mock

function renderModal(onRetry = jest.fn()) {
    const result = renderWithIntl(<CameraPermissionModal visible onRetry={onRetry} onClose={jest.fn()} />)
    return { ...result, onRetry }
}

beforeEach(() => {
    deviceType.current = DeviceType.IOS
    appStateListener.current = null
    jest.clearAllMocks()
})

describe('web', () => {
    beforeEach(() => {
        mockedIsNativeBridge.mockReturnValue(false)
        mockedCanOpenAppSettings.mockReturnValue(false)
    })

    it('keeps the browser screenshot carousel and the Try again CTA', () => {
        renderModal()
        expect(screen.getByAltText('Step 1: tap “aA” in the address bar')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
        expect(screen.queryByText('Open Settings')).not.toBeInTheDocument()
    })
})

describe('native', () => {
    beforeEach(() => {
        mockedIsNativeBridge.mockReturnValue(true)
        mockedCanOpenAppSettings.mockReturnValue(true)
    })

    it('drops every browser screenshot for OS text steps', () => {
        renderModal()
        expect(screen.queryByAltText('Step 1: tap “aA” in the address bar')).not.toBeInTheDocument()
        expect(
            screen.getByText(
                'Peanut needs the camera to scan a QR code. Turn on Camera for Peanut in your device settings.'
            )
        ).toBeInTheDocument()
        expect(screen.getByText('Open Settings and find Peanut')).toBeInTheDocument()
        expect(screen.getByText('Turn on Camera')).toBeInTheDocument()
    })

    it('gives android its own permissions steps', () => {
        mockedIsAndroidNativeBridge.mockReturnValue(true)
        renderModal()
        expect(screen.getByText('Tap Permissions')).toBeInTheDocument()
        expect(screen.getByText('Set Camera to Allow')).toBeInTheDocument()
        expect(screen.queryByText('Turn on Camera')).not.toBeInTheDocument()
    })

    it('deep-links to the app settings page instead of retrying', () => {
        const { onRetry } = renderModal()
        fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }))
        expect(openAppSettings).toHaveBeenCalled()
        expect(onRetry).not.toHaveBeenCalled()
    })

    it('retries on its own when the app comes back to the foreground', async () => {
        const { onRetry } = renderModal()
        await waitFor(() => expect(appStateListener.current).not.toBeNull())
        appStateListener.current?.({ isActive: false })
        expect(onRetry).not.toHaveBeenCalled()
        appStateListener.current?.({ isActive: true })
        expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('keeps the native steps but falls back to Try again on a binary that cannot deep-link', () => {
        mockedCanOpenAppSettings.mockReturnValue(false)
        renderModal()
        expect(screen.getByText('Open Settings and find Peanut')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Open Settings' })).not.toBeInTheDocument()
    })
})
