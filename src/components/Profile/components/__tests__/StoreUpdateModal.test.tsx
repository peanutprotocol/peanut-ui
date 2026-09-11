/**
 * StoreUpdateModal — the prompt for an update only the store can deliver.
 * It must never offer a restart: the JS is not on the device, so restarting
 * would reload the same bundle and read as an update that did nothing.
 */
import React from 'react'
import { renderWithIntl } from '@/test-utils/intl'
import { fireEvent, screen } from '@testing-library/react'
import StoreUpdateModal from '@/components/Profile/components/StoreUpdateModal'

const mockOpenStore = jest.fn()
const platform = { ios: false }

jest.mock('@/utils/migration.utils', () => ({ openStore: (...args: unknown[]) => mockOpenStore(...args) }))
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isIOSNative: () => platform.ios,
}))

beforeEach(() => {
    mockOpenStore.mockClear()
    platform.ios = false
})

it('names the store the update has to come from', () => {
    renderWithIntl(<StoreUpdateModal visible onClose={jest.fn()} />)
    expect(screen.getByText('Update in Google Play')).toBeInTheDocument()
    expect(screen.queryByText(/restart/i)).not.toBeInTheDocument()
})

it('names the App Store on iOS', () => {
    platform.ios = true
    renderWithIntl(<StoreUpdateModal visible onClose={jest.fn()} />)
    expect(screen.getByText('Update in App Store')).toBeInTheDocument()
})

it('sends the user to the store and closes', () => {
    const onClose = jest.fn()
    renderWithIntl(<StoreUpdateModal visible onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Google Play' }))

    expect(mockOpenStore).toHaveBeenCalledWith('android', 'profile_update')
    expect(onClose).toHaveBeenCalled()
})
