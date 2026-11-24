/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { isCapacitor } from '@/utils/capacitor'
import { AddMoneyPicker } from '../AddMoneyPicker'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }), usePathname: () => '/add-money' }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
let mockPickerMethods = ['pix', 'account', 'transfer', 'crypto']
jest.mock('../useAddMoneyReadiness', () => ({
    useAddMoneyReadiness: () => ({ pickerMethods: mockPickerMethods }),
}))
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: jest.fn(() => false),
}))

const tap = (key: string) => fireEvent.click(screen.getByTestId(`add-money-method-${key}`))

beforeEach(() => {
    mockPush.mockClear()
    mockPickerMethods = ['pix', 'account', 'transfer', 'crypto']
    jest.mocked(isCapacitor).mockReturnValue(false)
})

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

// TASK-25018: the Pix mark comes from CONCEPT_ICONS through IconBubble, not a raw Image with its own size
it('draws the Pix mark as the concept logo bubble', () => {
    renderWithIntl(<AddMoneyPicker onBack={jest.fn()} origin={null} />)
    const mark = screen.getByTestId('add-money-method-pix').querySelector('img')
    expect(mark).toHaveClass('size-full')
    expect(mark?.parentElement).toHaveClass('size-8', 'rounded-full')
})

// The owner, 24 Nov (TASK-25350): ARS leads for a resident of Argentina and opens the peso
// top-up directly, with the picker to come back to
describe('the ARS row', () => {
    beforeEach(() => {
        mockPickerMethods = ['ars', 'account', 'transfer', 'crypto']
    })

    it('leads the list as ARS with the AR flag, saying it is paid from Mercado Pago or a bank', () => {
        renderWithIntl(<AddMoneyPicker onBack={jest.fn()} origin={null} />)
        const rows = screen.getAllByTestId(/^add-money-method-/)
        expect(rows[0]).toHaveAttribute('data-testid', 'add-money-method-ars')
        expect(rows[0]).toHaveTextContent('ARS')
        expect(rows[0]).toHaveTextContent('From your Mercado Pago or bank account')
        expect(decodeURIComponent(rows[0].querySelector('img')?.getAttribute('src') ?? '')).toContain('/flags/ar.svg')
    })

    it('opens the peso top-up directly, with the picker to come back to', () => {
        renderWithIntl(<AddMoneyPicker onBack={jest.fn()} origin={null} />)
        tap('ars')
        expect(mockPush).toHaveBeenCalledWith('/add-money/argentina/manteca?returnTo=%2Fadd-money')
    })

    it('opens the native form of the top-up in the app, which has no country route', () => {
        jest.mocked(isCapacitor).mockReturnValue(true)
        renderWithIntl(<AddMoneyPicker onBack={jest.fn()} origin={null} />)
        tap('ars')
        expect(mockPush).toHaveBeenCalledWith('/add-money?country=argentina&view=manteca&returnTo=%2Fadd-money')
    })

    it('is absent when the methods resolve without it', () => {
        mockPickerMethods = ['account', 'transfer', 'crypto']
        renderWithIntl(<AddMoneyPicker onBack={jest.fn()} origin={null} />)
        expect(screen.queryByTestId('add-money-method-ars')).not.toBeInTheDocument()
    })
})
