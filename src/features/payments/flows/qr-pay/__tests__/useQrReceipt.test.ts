/**
 * The QR payment receipt is built from the flow's own state, before Activity
 * has the entry. Whether it has a public link to share comes from the history
 * entry, as on every other receipt (TASK-24141).
 */
import { renderHook } from '@testing-library/react'
import type { HistoryEntry } from '@/utils/history.utils'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

let mockEntry: HistoryEntry | undefined
const mockUseHistoryEntry = jest.fn()
jest.mock('@/hooks/useHistoryEntry', () => ({
    useHistoryEntry: (...args: unknown[]) => mockUseHistoryEntry(...args),
}))

let mockQrPayment: { id: string; status: string; details: Record<string, unknown> } | null
jest.mock('../QrPayFlowContext', () => ({
    useQrPayFlow: () => ({
        qrPayment: mockQrPayment,
        currency: { code: 'ARS', symbol: 'ARS', price: 1000 },
        usdAmount: '1',
        methodIcon: undefined,
        pixKeyOwner: null,
        pixKeyLabel: null,
    }),
}))

import { useQrReceipt } from '../useQrReceipt'

const completedPayment = {
    id: 'qp1',
    status: 'COMPLETED',
    details: { merchant: { name: 'Shop' }, paymentAssetAmount: '1000' },
}

const entry = (publicReceipt?: boolean) =>
    ({
        uuid: 'qp1',
        type: 'TRANSACTION_INTENT',
        extraData: { kind: 'QR_PAY', publicReceipt },
    }) as unknown as HistoryEntry

beforeEach(() => {
    mockQrPayment = completedPayment
    mockEntry = undefined
    mockUseHistoryEntry.mockReset()
    mockUseHistoryEntry.mockImplementation(() => ({ data: mockEntry }))
})

test('reads the entry by the Manteca synthetic id and the QR kind', () => {
    renderHook(() => useQrReceipt())
    expect(mockUseHistoryEntry).toHaveBeenCalledWith('qp1', 'QR_PAY')
})

test('has no public receipt before the entry loads', () => {
    const { result } = renderHook(() => useQrReceipt())
    expect(result.current?.extraDataForDrawer?.kind).toBe('QR_PAY')
    expect(result.current?.extraDataForDrawer?.publicReceipt).toBeUndefined()
})

test("takes the entry's public-receipt flag once it loads", () => {
    mockEntry = entry(true)
    const { result } = renderHook(() => useQrReceipt())
    expect(result.current?.id).toBe('qp1')
    expect(result.current?.extraDataForDrawer?.publicReceipt).toBe(true)
})

test('an entry with no public receipt leaves the flag off', () => {
    mockEntry = entry(false)
    const { result } = renderHook(() => useQrReceipt())
    expect(result.current?.extraDataForDrawer?.publicReceipt).toBeUndefined()
})

test('builds no receipt before the payment exists, and passes no entry id to read', () => {
    mockQrPayment = null
    const { result } = renderHook(() => useQrReceipt())
    expect(result.current).toBeNull()
    expect(mockUseHistoryEntry).toHaveBeenCalledWith(undefined, 'QR_PAY')
})
