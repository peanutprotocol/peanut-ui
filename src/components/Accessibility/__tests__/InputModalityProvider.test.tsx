import { fireEvent, render } from '@testing-library/react'
import { InputModalityProvider } from '../InputModalityProvider'

describe('InputModalityProvider', () => {
    afterEach(() => {
        document.documentElement.removeAttribute('data-input-modality')
    })

    it('records pointer and keyboard modality explicitly', () => {
        render(
            <InputModalityProvider>
                <div />
            </InputModalityProvider>
        )

        fireEvent.pointerDown(document.body)
        expect(document.documentElement).toHaveAttribute('data-input-modality', 'pointer')

        fireEvent.keyDown(document.body, { key: 'k' })
        expect(document.documentElement).toHaveAttribute('data-input-modality', 'pointer')

        fireEvent.keyDown(document.body, { key: 'Tab' })
        expect(document.documentElement).toHaveAttribute('data-input-modality', 'keyboard')
    })
})
