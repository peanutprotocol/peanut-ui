/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import ValidatedInput from '..'

it('tells the caller when the clear button empties the field', () => {
    const onClear = jest.fn()
    const onUpdate = jest.fn()
    renderWithIntl(
        <ValidatedInput
            aria-label="Username"
            value="abcd"
            validate={() => new Promise(() => undefined)}
            shouldValidate={() => false}
            onUpdate={onUpdate}
            onClear={onClear}
        />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenLastCalledWith({ value: '', isValid: false, isChanging: false })
})
