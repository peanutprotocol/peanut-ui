/**
 * Generic bank withdrawal amount step (TASK-21966): the minimum-amount error
 * must sit directly under the amount input, above Continue, so the Android
 * soft keyboard cannot hide it, and it is scrolled into view when it appears
 * while the field is focused.
 */
import { act, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { WithdrawAmountView } from '../WithdrawAmountView'

const MESSAGE = 'The minimum withdrawal is $2.00.'
const scrollIntoView = jest.fn()
const originalScrollIntoView = Element.prototype.scrollIntoView

type ErrorState = { showError: boolean; errorMessage: string }
const noError: ErrorState = { showError: false, errorMessage: '' }
const withError: ErrorState = { showError: true, errorMessage: MESSAGE }

function view(error: ErrorState) {
    return (
        <WithdrawAmountView
            pageTitle="Withdraw"
            heading="Amount to withdraw"
            initialAmount=""
            walletBalance="500.00"
            balanceFillAmount={500}
            onBalanceFilled={() => {}}
            onAmountChange={() => {}}
            onBack={() => {}}
            onContinue={() => {}}
            continueDisabled
            error={error}
            isCryptoWithdraw={false}
        />
    )
}

function setup(error: ErrorState = noError) {
    const utils = renderWithIntl(view(error))
    const input = screen.getByRole('textbox') as HTMLInputElement
    const show = async (next: ErrorState) => {
        act(() => utils.rerender(view(next)))
        await settle()
    }
    return { input, show }
}

// a deferred scroll (animation frame / short timer) must still land inside the assertion window
async function settle(): Promise<void> {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80))
    })
}

function followsInDocument(first: Element, second: Element): boolean {
    return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
}

beforeEach(() => {
    scrollIntoView.mockReset()
    Element.prototype.scrollIntoView = scrollIntoView
})

afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView
})

describe('minimum-amount error placement', () => {
    it('renders the error directly under the amount input and before the Continue button', () => {
        const { input } = setup(withError)
        const message = screen.getByText(MESSAGE)
        const continueButton = screen.getByRole('button', { name: 'Continue' })
        expect(followsInDocument(input, message)).toBe(true)
        expect(followsInDocument(message, continueButton)).toBe(true)
    })

    it('keeps the error out of the screen when there is none', () => {
        setup(noError)
        expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    })
})

describe('minimum-amount error scroll', () => {
    it('scrolls the error into view, nearest block, when it appears while the input is focused', async () => {
        const { input, show } = setup()
        act(() => input.focus())
        expect(document.activeElement).toBe(input)
        expect(scrollIntoView).not.toHaveBeenCalled()

        await show(withError)

        expect(scrollIntoView).toHaveBeenCalledTimes(1)
        expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }))
        const target = scrollIntoView.mock.contexts[0] as Element
        const message = screen.getByText(MESSAGE)
        expect(target === message || (target.contains(message) && !target.contains(input))).toBe(true)
    })

    it('does not scroll when the error appears while the input is not focused', async () => {
        const { input, show } = setup()
        act(() => input.blur())
        expect(document.activeElement).not.toBe(input)

        await show(withError)

        expect(screen.getByText(MESSAGE)).toBeInTheDocument()
        expect(scrollIntoView).not.toHaveBeenCalled()
    })

    it('scrolls once per appearance, not on unrelated re-renders', async () => {
        const { input, show } = setup()
        act(() => input.focus())

        await show(withError)
        await show({ ...withError })
        expect(scrollIntoView).toHaveBeenCalledTimes(1)

        await show(noError)
        expect(scrollIntoView).toHaveBeenCalledTimes(1)

        await show(withError)
        expect(scrollIntoView).toHaveBeenCalledTimes(2)
    })
})
