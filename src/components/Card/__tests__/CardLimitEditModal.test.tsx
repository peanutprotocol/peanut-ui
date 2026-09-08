import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import CardLimitEditModal from '../CardLimitEditModal'

const mockUpdate = jest.fn()
const mockInvalidate = jest.fn().mockResolvedValue(undefined)
const mockReturnExcess = jest.fn().mockResolvedValue(0)
jest.mock('@/services/rain', () => ({ rainApi: { updateCardLimits: (...args: unknown[]) => mockUpdate(...args) } }))
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidate }) }))
jest.mock('@/hooks/useRainCardOverview', () => ({ RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview' }))
jest.mock('@/hooks/wallet/useReturnExcessCollateral', () => ({
    useReturnExcessCollateral: () => ({ returnExcess: mockReturnExcess }),
}))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ content, ctas }: any) => (
        <div>
            {content}
            <button onClick={ctas[0].onClick}>Save</button>
        </div>
    ),
}))

beforeEach(() => {
    jest.clearAllMocks()
    mockUpdate.mockReset().mockResolvedValue(undefined)
})

function edit(value: string) {
    render(
        <CardLimitEditModal
            cardId="card-test"
            frequency="perAuthorization"
            label="Per transaction"
            initialAmountCents={10000}
            isOpen
            onClose={jest.fn()}
        />
    )
    fireEvent.change(screen.getByLabelText('Per transaction'), { target: { value } })
    fireEvent.click(screen.getByText('Save'))
}

test.each(['', '0', '-1', '0.001', '21474836.48'])(
    'rejects invalid dollar amount %s before provider update or collateral return',
    async (value) => {
        edit(value)
        expect(screen.getByText(/Enter an amount from/)).toBeInTheDocument()
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(mockReturnExcess).not.toHaveBeenCalled()
    }
)

test.each([
    ['0.01', 1],
    ['21474836.47', 2147483647],
] as const)('accepts boundary amount %s as exact cents', async (value, cents) => {
    edit(value)
    await waitFor(() =>
        expect(mockUpdate).toHaveBeenCalledWith('card-test', [{ amount: cents, frequency: 'perAuthorization' }])
    )
    await waitFor(() => expect(mockReturnExcess).toHaveBeenCalledWith(cents))
})

test('refreshes provider limits after an ambiguous failure and never returns collateral', async () => {
    mockUpdate.mockRejectedValue(new Error('Some card limits may have changed'))
    edit('50')
    await waitFor(() => expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['rain-card-limits', 'card-test'] }))
    expect(mockReturnExcess).not.toHaveBeenCalled()
    expect(await screen.findByText('Some card limits may have changed')).toBeInTheDocument()
})
