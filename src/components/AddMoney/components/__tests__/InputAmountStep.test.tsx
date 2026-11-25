/**
 * InputAmountStep — the optional next-step hint and button label (TASK-25101).
 * The ARS flow passes both; every other flow keeps the plain "Continue".
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import InputAmountStep from '../InputAmountStep'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/AmountInput', () => ({ __esModule: true, default: () => <input aria-label="amount" /> }))

const renderStep = (props: { nextStepHint?: string; submitLabel?: string } = {}) => {
    const onSubmit = jest.fn()
    render(
        <InputAmountStep
            tokenAmount="10000"
            setTokenAmount={jest.fn()}
            onSubmit={onSubmit}
            isLoading={false}
            error={null}
            setCurrencyAmount={jest.fn()}
            limitsCurrency="USD"
            onBack={jest.fn()}
            {...props}
        />,
        { wrapper: IntlWrapper }
    )
    return onSubmit
}

test('shows the next-step hint and submits from the renamed button', () => {
    const onSubmit = renderStep({
        nextStepHint: en.addMoney.manteca.transferDetailsNextStep,
        submitLabel: en.addMoney.manteca.seeTransferDetails,
    })

    expect(screen.getByText(en.addMoney.manteca.transferDetailsNextStep)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: en.addMoney.manteca.seeTransferDetails }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
})

test('without them the step keeps Continue and no hint', () => {
    renderStep()

    expect(screen.getByTestId('deposit-amount-continue')).toHaveTextContent(en.common.continue)
    expect(screen.queryByText(en.addMoney.manteca.transferDetailsNextStep)).not.toBeInTheDocument()
})
