import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasInvalidNumericUi } from './numeric-ui.mjs'

test('capture guard sees invalid text, input values and slider attributes', () => {
    for (const bad of ['NaN', 'Infinity', '-Infinity', '∞', '$NaN', 'NaN%']) {
        assert.equal(hasInvalidNumericUi({ text: `Pay ${bad}` }), true)
        assert.equal(hasInvalidNumericUi({ inputs: [bad] }), true)
        assert.equal(hasInvalidNumericUi({ sliderAttributes: [bad] }), true)
    }
})
test('every supported locale can render intended finite or unavailable amounts', () => {
    for (const locale of ['en', 'es-419', 'es-AR', 'pt-BR']) {
        const amount = new Intl.NumberFormat(locale).format(4000)
        assert.equal(
            hasInvalidNumericUi({ text: `${amount} USDC —`, inputs: ['4000'], sliderAttributes: ['100'] }),
            false
        )
    }
    assert.equal(hasInvalidNumericUi({ text: 'Banana nanosecond' }), false)
})
