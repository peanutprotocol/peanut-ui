import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import ForceUpdateScreen from '..'

const mockOpenStore = jest.fn()
jest.mock('@/utils/migration.utils', () => ({ openStore: (...args: unknown[]) => mockOpenStore(...args) }))
jest.mock('@/components/Global/PeanutMascot', () => () => null)

test('one way out: Update now opens the platform store, with no dismiss', () => {
    renderWithIntl(<ForceUpdateScreen platform="android" />)
    expect(screen.getByRole('heading', { name: 'Update Peanut' })).toBeTruthy()
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Update now'])
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }))
    expect(mockOpenStore).toHaveBeenCalledWith('android', 'force_update')
})
