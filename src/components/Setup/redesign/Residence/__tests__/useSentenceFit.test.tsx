/** @jest-environment jsdom */
/**
 * The 07/08 sentence fit (contract P3 § 3 panel, § 4 pill width; P3-36, P3-50): the size is picked against the
 * longest label a pill can hold, not the one it shows. jsdom has no layout, so the label widths are stubbed: a label
 * is as wide as its text is long (10 px a character) and its pill holds 120 px.
 */
import { render } from '@testing-library/react'
import { useRef } from 'react'
import { SENTENCE_CLASS, longestLabel, useSentenceFit } from '../useSentenceFit'

const PILL_PX = 120
let restore: (() => void)[] = []
const stub = (prop: 'scrollWidth' | 'clientWidth', get: (el: HTMLElement) => number) => {
    // jsdom defines these on Element.prototype; the stub shadows them on HTMLElement and is deleted after
    Object.defineProperty(HTMLElement.prototype, prop, {
        configurable: true,
        get: function (this: HTMLElement) {
            return get(this)
        },
    })
    restore.push(() => delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop])
}

beforeEach(() => {
    stub('scrollWidth', (el) => (el.hasAttribute('data-fit-label') ? (el.textContent ?? '').length * 10 : 0))
    stub('clientWidth', (el) => (el.hasAttribute('data-fit-label') ? PILL_PX : 0))
})
afterEach(() => {
    restore.forEach((undo) => undo())
    restore = []
})

function Sentence({ shown, worst }: { shown: string; worst: string }) {
    const ref = useRef<HTMLParagraphElement>(null)
    const cls = useSentenceFit(ref, { worst: { residence_country: worst } })
    return (
        <div>
            <p ref={ref} className={cls} data-testid="sentence">
                I live in{' '}
                <span data-fit-group>
                    <span data-fit-label="residence_country">{shown}</span>
                </span>
            </p>
            <footer data-setup-footer />
        </div>
    )
}

it('P3-36 a short name that fits keeps the regular size when the longest name fits too', () => {
    const { getByTestId } = render(<Sentence shown="Peru" worst="Argentina" />)
    expect(getByTestId('sentence').className).toBe(SENTENCE_CLASS.regular)
})

it('P3-36 steps down at once when the longest name would be cut, before any pick shows it', () => {
    const { getByTestId } = render(<Sentence shown="Peru" worst="Bosnia and Herzegovina" />)
    expect(getByTestId('sentence').className).toBe(SENTENCE_CLASS.small)
    // the probe is gone and the shown label is untouched
    expect(document.querySelectorAll('[data-fit-label]')).toHaveLength(1)
    expect(document.querySelector('[data-fit-label]')).toHaveTextContent('Peru')
})

it('longestLabel picks the longest label', () => {
    expect(longestLabel(['Banco ARS', 'Transferencia', 'Pix'])).toBe('Transferencia')
    expect(longestLabel([])).toBe('')
})
