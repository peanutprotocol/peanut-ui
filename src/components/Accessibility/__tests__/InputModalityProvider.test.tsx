import { fireEvent, render } from '@testing-library/react'
import { InputModalityProvider } from '../InputModalityProvider'

describe('InputModalityProvider', () => {
    afterEach(() => {
        document.documentElement.removeAttribute('data-input-modality')
    })

    it('records pointer and keyboard modality explicitly', () => {
        const { getByRole, getByTestId } = render(
            <InputModalityProvider>
                <button type="button">Activate</button>
                <input data-testid="text-input" />
            </InputModalityProvider>
        )
        const button = getByRole('button')
        const input = getByTestId('text-input')

        fireEvent.pointerDown(input)
        expect(document.documentElement).toHaveAttribute('data-input-modality', 'pointer')

        fireEvent.keyDown(input, { key: ' ' })
        expect(document.documentElement).toHaveAttribute('data-input-modality', 'pointer')

        fireEvent.pointerDown(button)
        fireEvent.keyDown(button, { key: ' ' })
        expect(document.documentElement).toHaveAttribute('data-input-modality', 'keyboard')

        fireEvent.pointerDown(document.body)
        expect(document.documentElement).toHaveAttribute('data-input-modality', 'pointer')

        fireEvent.keyDown(document.body, { key: 'k' })
        expect(document.documentElement).toHaveAttribute('data-input-modality', 'pointer')

        fireEvent.keyDown(document.body, { key: 'Tab' })
        expect(document.documentElement).toHaveAttribute('data-input-modality', 'keyboard')
    })

    it('keeps pointer modality while typing a whitespace character in a textarea', () => {
        render(
            <InputModalityProvider>
                <textarea data-testid="text-area" />
            </InputModalityProvider>
        )
        const textArea = document.querySelector('[data-testid="text-area"]')!

        fireEvent.pointerDown(textArea)
        expect(document.documentElement).toHaveAttribute('data-input-modality', 'pointer')

        fireEvent.keyDown(textArea, { key: ' ' })
        expect(document.documentElement).toHaveAttribute('data-input-modality', 'pointer')
    })
})
