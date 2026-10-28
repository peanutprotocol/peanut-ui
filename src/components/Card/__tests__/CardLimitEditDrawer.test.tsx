import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import CardLimitEditDrawer from '../CardLimitEditDrawer'

const mockUpdate = jest.fn()
const mockInvalidate = jest.fn().mockResolvedValue(undefined)
jest.mock('@/services/rain', () => ({ rainApi: { updateCardLimits: (...args: unknown[]) => mockUpdate(...args) } }))
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidate }) }))
jest.mock('@/hooks/useRainCardOverview', () => ({ RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview' }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
beforeEach(() => {
    jest.clearAllMocks()
    mockUpdate.mockReset().mockResolvedValue(undefined)
})

function edit(value: string) {
    const onClose = jest.fn()
    render(
        <CardLimitEditDrawer
            cardId="card-test"
            frequency="perAuthorization"
            label="Per transaction"
            initialAmountCents={10000}
            isOpen
            onClose={onClose}
        />
    )
    fireEvent.change(screen.getByLabelText('Per transaction'), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    return onClose
}

test.each(['', '0', '-1', '0.001', '21474836.48'])(
    'rejects invalid dollar amount %s before provider update',
    async (value) => {
        edit(value)
        expect(screen.getByText(/Enter an amount from/)).toBeInTheDocument()
        expect(mockUpdate).not.toHaveBeenCalled()
    }
)

test.each([
    ['0.01', 1],
    ['21474836.47', 2147483647],
] as const)('accepts boundary amount %s as exact cents', async (value, cents) => {
    const onClose = edit(value)
    await waitFor(() =>
        expect(mockUpdate).toHaveBeenCalledWith('card-test', [{ amount: cents, frequency: 'perAuthorization' }])
    )
    // The limit is only a spending limit: a save is one PATCH, then close.
    await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('renders an ambiguous provider failure as a flow notification and refreshes limits', async () => {
    mockUpdate.mockRejectedValue(new Error('Some card limits may have changed'))
    edit('50')
    await waitFor(() => expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['rain-card-limits', 'card-test'] }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Some card limits may have changed')
    expect(screen.getByRole('alert')).toHaveClass('bg-background-badge-error')
})
