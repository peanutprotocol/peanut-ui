/**
 * InputAmountStep — the optional button label (TASK-25101).
 * The ARS flow names the next step on the button; every other flow keeps "Continue".
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import InputAmountStep from '../InputAmountStep'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/AmountInput', () => ({ __esModule: true, default: () => <input aria-label="amount" /> }))

const renderStep = (props: { submitLabel?: string } = {}) => {
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

test('submits from the renamed button', () => {
    const onSubmit = renderStep({ submitLabel: en.addMoney.manteca.seeTransferDetails })

    fireEvent.click(screen.getByRole('button', { name: en.addMoney.manteca.seeTransferDetails }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
})

test('without a label the step keeps Continue', () => {
    renderStep()

    expect(screen.getByTestId('deposit-amount-continue')).toHaveTextContent(en.common.continue)
})
