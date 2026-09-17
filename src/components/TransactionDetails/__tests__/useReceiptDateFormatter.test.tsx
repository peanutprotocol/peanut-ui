import { render, screen } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'
import { useReceiptDateFormatter } from '../useReceiptDateFormatter'

describe('useReceiptDateFormatter', () => {
    test('renders a short locale date and a separate time segment', () => {
        const { result } = renderHookWithIntl(() => useReceiptDateFormatter())

        render(<>{result.current(new Date('2026-01-02T03:04:00.000Z'))}</>)

        expect(screen.getByText('Jan 2, 2026')).toBeInTheDocument()
        expect(screen.getByText('03:04')).toBeInTheDocument()
        expect(document.body).toHaveTextContent('Jan 2, 2026 03:04')
    })

    test('keeps the unavailable timestamp fallback', () => {
        const { result } = renderHookWithIntl(() => useReceiptDateFormatter())

        render(<>{result.current(undefined)}</>)

        expect(screen.getByText('—')).toBeInTheDocument()
    })
})
