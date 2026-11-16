/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { AddMoneyPicker } from '../AddMoneyPicker'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }), usePathname: () => '/add-money' }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('../useAddMoneyReadiness', () => ({
    useAddMoneyReadiness: () => ({ pickerMethods: ['pix', 'account', 'transfer', 'crypto'] }),
}))

const tap = (key: string) => fireEvent.click(screen.getByTestId(`add-money-method-${key}`))

beforeEach(() => mockPush.mockClear())

// Aleks, 2026-11-16 (TASK-25033): Pix opened a "Pix" screen with one BRL row to tap again.
it('opens the Pix deposit directly, with the picker to come back to', () => {
    renderWithIntl(<AddMoneyPicker onBack={jest.fn()} origin={null} />)
    tap('pix')
    expect(mockPush).toHaveBeenCalledWith('/add-money/pix?returnTo=%2Fadd-money')
})

it.each([
    ['account', '/add-money/options?method=account&returnTo=%2Fadd-money'],
    ['transfer', '/add-money/options?method=transfer&returnTo=%2Fadd-money'],
    ['crypto', '/add-money/crypto?returnTo=%2Fadd-money'],
])('keeps the %s row on its own screen', (key, href) => {
    renderWithIntl(<AddMoneyPicker onBack={jest.fn()} origin={null} />)
    tap(key)
    expect(mockPush).toHaveBeenCalledWith(href)
})
