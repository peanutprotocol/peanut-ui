/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { isCapacitor } from '@/utils/capacitor'
import { AddMoneyPicker } from '../AddMoneyPicker'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }), usePathname: () => '/add-money' }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
let mockPickerMethods = ['pix', 'bank', 'crypto']
let mockMethodsLoading = false
jest.mock('../useAddMoneyReadiness', () => ({
    useAddMoneyReadiness: () => ({
        pickerMethods: mockPickerMethods,
        isLoading: mockMethodsLoading,
        residenceIso2s: [],
    }),
}))
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: jest.fn(() => false),
}))

const tap = (key: string) => fireEvent.click(screen.getByTestId(`add-money-method-${key}`))

beforeEach(() => {
    mockPush.mockClear()
    mockPickerMethods = ['pix', 'bank', 'crypto']
    mockMethodsLoading = false
    jest.mocked(isCapacitor).mockReturnValue(false)
})

// Aleks, 26 Nov (TASK-25444): Pix or ARS appeared above Bank transfer after the rows were tappable
it('shows no tappable row until the methods resolve', () => {
    mockMethodsLoading = true
    renderWithIntl(<AddMoneyPicker onBack={jest.fn()} origin={null} />)
    expect(screen.getByTestId('add-money-methods-loading')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryAllByTestId(/^add-money-method-/)).toHaveLength(0)
})

// Aleks, 2026-11-16 (TASK-25033): Pix opened a "Pix" screen with one BRL row to tap again.
it('opens the Pix deposit directly, with the picker to come back to', () => {
    renderWithIntl(<AddMoneyPicker onBack={jest.fn()} origin={null} />)
    tap('pix')
    expect(mockPush).toHaveBeenCalledWith('/add-money/pix?returnTo=%2Fadd-money')
})

it('keeps the crypto row on its own screen', () => {
    renderWithIntl(<AddMoneyPicker onBack={jest.fn()} origin={null} />)
    tap('crypto')
    expect(mockPush).toHaveBeenCalledWith('/add-money/crypto?returnTo=%2Fadd-money')
})

// The owner, 25 Nov (Release 170.2): one bank row again, never "Open a bank account" beside
// "One-time bank transfer". The bank hub behind it picks the reusable account or the one-time transfer.
describe('the bank row', () => {
    it('is one plain "Bank transfer" row that never offers a temporary or one-time choice', () => {
        renderWithIntl(<AddMoneyPicker onBack={jest.fn()} origin={null} />)
        const rows = screen.getAllByTestId(/^add-money-method-/)
        expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
            'add-money-method-pix',
            'add-money-method-bank',
            'add-money-method-crypto',
        ])
        expect(screen.getByTestId('add-money-method-bank')).toHaveTextContent('Bank transfer')
        expect(screen.getByTestId('add-money-method-bank')).toHaveTextContent('From your bank account')
        expect(document.body).not.toHaveTextContent(/temporary|one-time|open a bank account/i)
    })

    it('opens the bank hub, which returns to Home when the picker was opened from Home', () => {
        renderWithIntl(<AddMoneyPicker onBack={jest.fn()} origin={null} />)
        tap('bank')
        expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank')
    })

    // the hub shares the picker's path, so a returnTo naming the picker would be dropped as itself
    it('carries the origin the picker was opened from to the bank hub', () => {
        renderWithIntl(<AddMoneyPicker onBack={jest.fn()} origin="/request/abc" />)
        tap('bank')
        expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank&returnTo=%2Frequest%2Fabc')
    })
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
        mockPickerMethods = ['ars', 'bank', 'crypto']
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
        mockPickerMethods = ['bank', 'crypto']
        renderWithIntl(<AddMoneyPicker onBack={jest.fn()} origin={null} />)
        expect(screen.queryByTestId('add-money-method-ars')).not.toBeInTheDocument()
    })
})
