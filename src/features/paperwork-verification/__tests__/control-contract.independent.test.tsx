import { useState } from 'react'
import { act, fireEvent, renderHook, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { KycControlFlowProvider, KycControlScreenProvider, useKycControl } from '../analytics'
import { QuestionFields } from '../components/QuestionFields'

const mockCapture = jest.fn()

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
    capture: (...args: unknown[]) => mockCapture(...args),
}))
jest.mock('posthog-js/react', () => ({
    usePostHog: () => ({ capture: (...args: unknown[]) => mockCapture(...args) }),
}))

describe('KYC control analytics public contract', () => {
    beforeEach(() => mockCapture.mockReset())

    it('captures the explicit fallback flow and omits an undefined value', () => {
        const { result } = renderHook(() => useKycControl('document_upload', 'kyc_legacy'))
        act(() => {
            result.current.track('continue', 'tap')
            result.current.track('document_type', 'select', 'passport')
        })
        expect(mockCapture).toHaveBeenNthCalledWith(1, 'control_used', {
            flow: 'kyc_legacy',
            screen_id: 'document_upload',
            control: 'continue',
            action: 'tap',
        })
        expect(mockCapture).toHaveBeenNthCalledWith(2, 'control_used', {
            flow: 'kyc_legacy',
            screen_id: 'document_upload',
            control: 'document_type',
            action: 'select',
            value: 'passport',
        })
        expect(mockCapture.mock.calls[0][1]).not.toHaveProperty('value')
    })

    it('deduplicates each control and action across rerenders and resets on remount', () => {
        const { result, rerender, unmount } = renderHook(() => useKycControl('document_upload', 'kyc_legacy'))
        act(() => {
            result.current.trackOnce('help', 'open')
            result.current.trackOnce('help', 'open')
            result.current.trackOnce('help', 'dismiss')
            result.current.trackOnce('continue', 'open')
        })
        rerender()
        act(() => result.current.trackOnce('help', 'open'))
        expect(mockCapture).toHaveBeenCalledTimes(3)
        unmount()
        const remounted = renderHook(() => useKycControl('document_upload', 'kyc_legacy'))
        act(() => remounted.result.current.trackOnce('help', 'open'))
        expect(mockCapture).toHaveBeenCalledTimes(4)
    })

    it('does not deduplicate ordinary track calls', () => {
        const { result } = renderHook(() => useKycControl('document_upload', 'kyc_legacy'))
        act(() => {
            result.current.track('continue', 'tap')
            result.current.track('continue', 'tap')
        })
        expect(mockCapture).toHaveBeenCalledTimes(2)
    })

    it('contains capture failures and consumes a failed once call', () => {
        mockCapture.mockImplementationOnce(() => {
            throw new Error('capture failed')
        })
        const { result } = renderHook(() => useKycControl('document_upload', 'kyc_legacy'))
        expect(() => act(() => result.current.trackOnce('help', 'open'))).not.toThrow()
        expect(() => act(() => result.current.trackOnce('help', 'open'))).not.toThrow()
        expect(mockCapture).toHaveBeenCalledTimes(1)
        mockCapture.mockImplementationOnce(() => {
            throw new Error('capture failed')
        })
        expect(() => act(() => result.current.track('continue', 'tap'))).not.toThrow()
    })

    it('is a safe no-op without provider or explicit flow', () => {
        const { result } = renderHook(() => useKycControl('document_upload'))
        expect(() =>
            act(() => {
                result.current.track('continue', 'tap')
                result.current.trackOnce('help', 'open')
            })
        ).not.toThrow()
        expect(mockCapture).not.toHaveBeenCalled()
    })

    it('does not include user-entered values in these control events', () => {
        const typed = { street: '123 Main Street', taxId: 'A123456789' }
        function Fields() {
            const [values, setValues] = useState<Record<string, string>>({})
            return (
                <QuestionFields
                    fields={Object.keys(typed).map((key) => ({ key, kind: 'text', required: true, value: null }))}
                    values={values}
                    errors={{}}
                    residence="US"
                    onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
                />
            )
        }
        renderWithIntl(
            <KycControlFlowProvider value="kyc_legacy">
                <KycControlScreenProvider value="document_upload">
                    <Fields />
                </KycControlScreenProvider>
            </KycControlFlowProvider>
        )
        for (const [key, value] of Object.entries(typed))
            fireEvent.change(screen.getByTestId(`verify-input-${key}`), { target: { value } })
        expect(mockCapture.mock.calls).toEqual([
            ['control_used', { flow: 'kyc_legacy', screen_id: 'document_upload', control: 'street', action: 'change' }],
            ['control_used', { flow: 'kyc_legacy', screen_id: 'document_upload', control: 'taxId', action: 'change' }],
        ])
        const calls = JSON.stringify(mockCapture.mock.calls)
        for (const value of Object.values(typed)) expect(calls).not.toContain(value)
    })
})
