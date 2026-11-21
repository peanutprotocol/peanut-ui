/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { STORE_URL } from '@/constants/migration.consts'
import { UpdateRequiredScreen } from '../index'

const mockGetPlatform = jest.fn()
const mockOpenExternalUrl = jest.fn(() => Promise.resolve())
jest.mock('@/utils/capacitor', () => ({
    getPlatform: () => mockGetPlatform(),
    openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...(args as [])),
}))

jest.mock('@/utils/sentry-lazy', () => ({ captureMessage: jest.fn() }))

describe('UpdateRequiredScreen', () => {
    beforeEach(() => jest.clearAllMocks())

    it('sends a too-old android binary to Google Play', () => {
        mockGetPlatform.mockReturnValue('android-native')
        renderWithIntl(<UpdateRequiredScreen update="store" />)
        expect(screen.getByRole('heading', { level: 1, name: 'Update Peanut to keep going' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Update Peanut' }))
        expect(mockOpenExternalUrl).toHaveBeenCalledWith(STORE_URL.android)
    })

    it('sends a too-old ios binary to the App Store', () => {
        mockGetPlatform.mockReturnValue('ios-native')
        renderWithIntl(<UpdateRequiredScreen update="store" />)
        fireEvent.click(screen.getByRole('button', { name: 'Update Peanut' }))
        expect(mockOpenExternalUrl).toHaveBeenCalledWith(STORE_URL.ios)
    })

    it('offers a reload for an old bundle, and on the web where there is no store', () => {
        mockGetPlatform.mockReturnValue('web')
        renderWithIntl(<UpdateRequiredScreen update="store" />)
        expect(screen.getByText(/Reload to keep going/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
        expect(mockOpenExternalUrl).not.toHaveBeenCalled()
    })
})
