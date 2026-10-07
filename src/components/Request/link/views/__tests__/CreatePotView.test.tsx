import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { CreatePotView } from '../CreatePotView'

const generateLink = jest.fn()
const updatePurpose = jest.fn()
const updateGoal = jest.fn()
let state = {
    requestAmount: '',
    attachmentOptions: { message: '' },
    errorState: { showError: false, errorMessage: '' },
    requestId: null as string | null,
    generatedLink: null as string | null,
    isCreatingLink: false,
}
jest.mock('../useCreateRequestLink', () => ({
    useCreateRequestLink: () => ({
        ...state,
        generateLink,
        handleAttachmentOptionsChange: updatePurpose,
        handleRequestAmountChange: updateGoal,
    }),
}))
jest.mock('@/components/Request/useRequestBack', () => ({ useRequestBack: () => jest.fn() }))
jest.mock('@/components/Global/AmountInput', () => ({
    __esModule: true,
    default: ({
        initialAmount,
        setPrimaryAmount,
    }: {
        initialAmount: string
        setPrimaryAmount: (v: string) => void
    }) => <input aria-label="Goal amount" value={initialAmount} onChange={(e) => setPrimaryAmount(e.target.value)} />,
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('../RequestCreatedView', () => ({
    RequestCreatedView: ({ generatedLink }: { generatedLink: string }) => (
        <div data-testid="created-pot">{generatedLink}</div>
    ),
}))

beforeEach(() => {
    jest.clearAllMocks()
    state = {
        requestAmount: '',
        attachmentOptions: { message: '' },
        errorState: { showError: false, errorMessage: '' },
        requestId: null,
        generatedLink: null,
        isCreatingLink: false,
    }
})
const renderView = () =>
    render(
        <IntlWrapper>
            <CreatePotView />
        </IntlWrapper>
    )

it('requires a purpose and explains direct funding before create', () => {
    renderView()
    expect(screen.getByRole('button', { name: 'Create pot' })).toBeDisabled()
    expect(screen.getByText(/Contributions go directly to the organiser/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('What are you raising money for?'), { target: { value: 'Garden' } })
    expect(updatePurpose).toHaveBeenCalledWith({ message: 'Garden' })
})

it.each(['', '500'])('allows a purpose with optional goal %s', (goal) => {
    state.attachmentOptions.message = 'Garden'
    state.requestAmount = goal
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Create pot' }))
    expect(generateLink).toHaveBeenCalledTimes(1)
})

it('waits for the UUID link before showing the sharing screen', () => {
    state.requestId = 'pot-1'
    const view = renderView()
    expect(screen.queryByTestId('created-pot')).not.toBeInTheDocument()
    state.generatedLink = 'https://peanut.me/owner/USDC?id=pot-1&mode=pot'
    view.rerender(
        <IntlWrapper>
            <CreatePotView />
        </IntlWrapper>
    )
    expect(screen.getByTestId('created-pot')).toHaveTextContent('id=pot-1&mode=pot')
})
