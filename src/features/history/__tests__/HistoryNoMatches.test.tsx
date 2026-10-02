import { fireEvent, render, screen } from '@testing-library/react'
import { HistoryNoMatches } from '../HistoryNoMatches'

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string, params?: Record<string, string>) =>
        params ? `${key} ${Object.values(params).join(' ')}` : key,
}))
jest.mock('@/components/Global/EmptyStates/NoDataEmptyState', () => {
    const NoDataEmptyState = ({ message }: { message: string }) => <p>{message}</p>
    return NoDataEmptyState
})

const setup = (props: Partial<React.ComponentProps<typeof HistoryNoMatches>>) => {
    const handlers = { onClearSearch: jest.fn(), onShowAll: jest.fn(), onClearAll: jest.fn() }
    render(<HistoryNoMatches query="" filter="all" hasMatchesInAll={false} {...handlers} {...props} />)
    return handlers
}

describe('HistoryNoMatches', () => {
    it('search only: names the query and clears the search', () => {
        const h = setup({ query: ' ss ' })
        expect(screen.getByText('noMatches.query ss')).toBeInTheDocument()
        expect(screen.getByText('noMatches.hint')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'clearSearch' }))
        expect(h.onClearSearch).toHaveBeenCalled()
    })

    it('pill only: shows all activity, no spelling hint', () => {
        const h = setup({ filter: 'requests' })
        expect(screen.getByText('noMatches.inFilter filter.requests')).toBeInTheDocument()
        expect(screen.queryByText('noMatches.hint')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'noMatches.showAll' }))
        expect(h.onShowAll).toHaveBeenCalled()
    })

    it('both, matches elsewhere: keeps the search and lifts the pill', () => {
        const h = setup({ query: 'bob', filter: 'payments', hasMatchesInAll: true })
        fireEvent.click(screen.getByRole('button', { name: 'noMatches.searchAll' }))
        expect(h.onShowAll).toHaveBeenCalled()
        expect(h.onClearAll).not.toHaveBeenCalled()
    })

    it('both, nothing anywhere: clears both', () => {
        const h = setup({ query: 'zz', filter: 'payments', hasMatchesInAll: false })
        fireEvent.click(screen.getByRole('button', { name: 'noMatches.clearAll' }))
        expect(h.onClearAll).toHaveBeenCalled()
    })
})
