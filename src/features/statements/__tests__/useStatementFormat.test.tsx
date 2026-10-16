import { act, renderHook } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { useStatementFormat } from '../useStatementFormat'

function renderFormat(search = '') {
    const updates: UrlUpdateEvent[] = []
    const view = renderHook(() => useStatementFormat(), {
        wrapper: withNuqsTestingAdapter({ searchParams: search, hasMemory: true, onUrlUpdate: (e) => updates.push(e) }),
    })
    return { ...view, url: () => updates.at(-1)?.searchParams }
}

describe('useStatementFormat', () => {
    it('defaults to PDF', () => {
        expect(renderFormat().result.current.format).toBe('pdf')
    })

    it.each(['pdf', 'csv', 'xlsx'] as const)('reads ?format=%s from a deep link', (format) => {
        expect(renderFormat(`?format=${format}`).result.current.format).toBe(format)
    })

    it('reads an unknown format as PDF', () => {
        expect(renderFormat('?format=docx').result.current.format).toBe('pdf')
    })

    it('writes the chosen format, and PDF, the default, leaves the URL without one', async () => {
        const { result, url } = renderFormat()
        await act(() => result.current.setFormat('csv'))
        expect(url()?.get('format')).toBe('csv')
        expect(result.current.format).toBe('csv')

        await act(() => result.current.setFormat('pdf'))
        expect(url()?.has('format')).toBe(false)
        expect(result.current.format).toBe('pdf')
    })
})
