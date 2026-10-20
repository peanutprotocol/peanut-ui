import { act, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { USER } from '@/constants/query.consts'
import { LocaleSync } from '../LocaleSync'

let mockLocale = 'en'
let mockApplied: string | null = null

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ userId: 'u1' }) }))
jest.mock('../AppIntlProvider', () => ({ useAppLocale: () => ({ locale: mockLocale }) }))
jest.mock('../locale-store', () => ({
    currentAppLocale: () => mockApplied,
    localeReady: () => Promise.resolve(mockApplied ?? 'en'),
}))
jest.mock('../locale-sync', () => ({ syncLocaleToBackend: jest.fn() }))

function renderAt(client: QueryClient) {
    return render(
        <QueryClientProvider client={client}>
            <LocaleSync />
        </QueryClientProvider>
    )
}

describe('LocaleSync user refetch', () => {
    let client: QueryClient
    let invalidate: jest.SpyInstance

    beforeEach(() => {
        client = new QueryClient()
        invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue()
    })

    it('refetches the user when a saved spanish locale applies after the english hydration render', async () => {
        // cold start: english hydration render while spanish is still loading
        mockLocale = 'en'
        mockApplied = 'es-AR'
        const view = renderAt(client)
        await act(async () => {})
        expect(invalidate).not.toHaveBeenCalled()

        mockLocale = 'es-AR'
        view.rerender(
            <QueryClientProvider client={client}>
                <LocaleSync />
            </QueryClientProvider>
        )
        await act(async () => {})
        expect(invalidate).toHaveBeenCalledTimes(1)
        expect(invalidate).toHaveBeenCalledWith({ queryKey: [USER] })
    })

    it('does not refetch on an english cold start', async () => {
        mockLocale = 'en'
        mockApplied = 'en'
        renderAt(client)
        await act(async () => {})
        expect(invalidate).not.toHaveBeenCalled()
    })

    it('refetches on a later manual switch', async () => {
        mockLocale = 'en'
        mockApplied = 'en'
        const view = renderAt(client)
        await act(async () => {})

        mockLocale = 'pt-BR'
        mockApplied = 'pt-BR'
        view.rerender(
            <QueryClientProvider client={client}>
                <LocaleSync />
            </QueryClientProvider>
        )
        await act(async () => {})
        expect(invalidate).toHaveBeenCalledTimes(1)
    })
})
