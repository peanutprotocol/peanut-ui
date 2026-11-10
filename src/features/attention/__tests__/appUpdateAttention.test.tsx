import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { JourneyState } from '../types'
import { appUpdateImportant, appUpdateRegular } from '../registry'
import { isSilenced } from '../decide'
import AppUpdateDrawer from '../surfaces/AppUpdateDrawer'
import AppUpdateCard from '../surfaces/zone/AppUpdateCard'

const mockOpenStore = jest.fn()
const mockState = { deviceType: 'android', storeUpdatePrompt: { platform: 'ios' } }
jest.mock('@/utils/migration.utils', () => ({ openStore: (...args: unknown[]) => mockOpenStore(...args) }))
jest.mock('../AttentionProvider', () => ({ useAttention: () => ({ state: mockState }) }))

const state = (tier: 1 | 4, version = '1.2.3') =>
    ({
        userId: 'user',
        userLoaded: true,
        isNative: true,
        deviceType: 'ios',
        now: 1000,
        storeUpdatePrompt: { tier, version, platform: 'ios' },
    }) as JourneyState

test('only the confirmed device tier is eligible, without unknown holds', () => {
    expect(appUpdateImportant.eligible(state(1))).toBe('show')
    expect(appUpdateRegular.eligible(state(1))).toBe('ineligible')
    expect(appUpdateRegular.eligible(state(4))).toBe('show')
    expect(appUpdateImportant.eligible(state(4))).toBe('ineligible')
    expect(appUpdateImportant.eligible({ ...state(1), storeUpdatePrompt: null })).toBe('ineligible')
    expect(appUpdateImportant.deviceGate?.({ ...state(1), isNative: false })).toBe('ineligible')
    expect(appUpdateImportant.eligible({ ...state(1), deviceType: 'android' })).toBe('show')
})

test('snooze belongs to the target version', () => {
    const entry = { version: '1.2.3', snoozedUntil: new Date(2000).toISOString() }
    expect(isSilenced(appUpdateImportant, entry, state(1))).toBe(true)
    expect(isSilenced(appUpdateImportant, entry, state(1, '1.2.4'))).toBe(false)
})

test.each([
    ['drawer', AppUpdateDrawer],
    ['card', AppUpdateCard],
] as const)('%s opens the store once, records action and snoozes without completion', (_name, Surface) => {
    const onAction = jest.fn(),
        onSnoozed = jest.fn(),
        onActed = jest.fn()
    mockOpenStore.mockClear()
    renderWithIntl(
        <Surface
            presentation="drawer"
            mode="ask"
            askId="app-update-important"
            onAction={onAction}
            onSnoozed={onSnoozed}
            onActed={onActed}
            onDismissed={jest.fn()}
        />
    )
    expect(screen.getByText('Update Peanut')).toBeTruthy()
    expect(screen.getByText('Get the latest version for a better experience.')).toBeTruthy()
    const button = screen.getByText(_name === 'drawer' ? 'Open App Store' : 'Update Peanut')
    fireEvent.click(button)
    fireEvent.click(button)
    expect(mockOpenStore).toHaveBeenCalledTimes(1)
    expect(mockOpenStore).toHaveBeenCalledWith('ios', expect.any(String))
    expect(onAction).toHaveBeenCalledWith({ cta: 'store' })
    expect(onSnoozed).toHaveBeenCalledTimes(1)
    expect(onActed).not.toHaveBeenCalled()
})
