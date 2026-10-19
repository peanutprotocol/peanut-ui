import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import AmountInput from '..'

// TASK-23856: a pot payer typed $33.05, went to the deposit address and back,
// and the field showed the new remainder, $58.51, which the next tap charged.
// The suggestion fills the field only while the field holds nothing of the payer's.

const field = (props: { suggestion?: number; initialAmount?: string; setAmount?: jest.Mock }) => (
    <AmountInput
        initialAmount={props.initialAmount}
        setPrimaryAmount={props.setAmount ?? jest.fn()}
        hideCurrencyToggle
        showSlider
        maxAmount={100}
        defaultSliderSuggestedAmount={props.suggestion}
    />
)

const value = () => (screen.getByRole('textbox') as HTMLInputElement).value

test('an empty field takes the suggestion, and follows it while untouched', () => {
    const { rerender } = renderWithIntl(field({ suggestion: 99.16 }))
    expect(value()).toBe('99.16')

    // the remainder loads after the field: the field still holds only our figure
    rerender(field({ suggestion: 58.51 }))
    expect(value()).toBe('58.51')
})

test('a typed amount survives a suggestion change', () => {
    const { rerender } = renderWithIntl(field({ suggestion: 99.16 }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '33.05' } })

    rerender(field({ suggestion: 58.51 }))
    expect(value()).toBe('33.05')
})

test('a typed amount survives a remount that passes it back', () => {
    const setAmount = jest.fn()
    const { unmount } = renderWithIntl(field({ suggestion: 99.16, setAmount }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '33.05' } })
    expect(setAmount).toHaveBeenLastCalledWith('33.05')
    unmount()

    // back from the deposit address: the flow kept 33.05, the remainder is now 58.51
    renderWithIntl(field({ suggestion: 58.51, initialAmount: '33.05', setAmount }))
    expect(value()).toBe('33.05')
    expect(setAmount).toHaveBeenLastCalledWith('33.05')
})

test('a cleared field stays empty: clearing is the payer editing it', () => {
    const { rerender } = renderWithIntl(field({ suggestion: 99.16 }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })

    rerender(field({ suggestion: 58.51 }))
    expect(value()).toBe('')
})
