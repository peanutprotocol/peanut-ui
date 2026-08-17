/**
 * @jest-environment node
 *
 * RuleTester needs structuredClone, which this jsdom version does not provide.
 *
 * The rule's value is entirely in where it draws the prose/not-prose line: too
 * loose and every `variant="warning"` becomes an error, too tight and the bug it
 * exists for (card balance-due notice, card-receipt adjustment) walks straight
 * through. Both edges are pinned here.
 */
const { RuleTester } = require('eslint')
const tsParser = require('@typescript-eslint/parser')
const rule = require('../copy-props-from-catalog')

const ruleTester = new RuleTester({
    languageOptions: {
        parser: tsParser,
        parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
})

ruleTester.run('copy-props-from-catalog', rule, {
    valid: [
        // not copy props
        '<InfoCard variant="warning" icon="credit-card" />',
        '<button type="button" className="flex items-center" />',
        '<a href="https://peanut.me/en/card-terms-us" />',
        // copy props holding a single token, an id or a code
        '<PaymentInfoRow label="CUIT" />',
        '<PaymentInfoRow label="USD" />',
        '<Row title="card-terms-us" />',
        // copy props fed from the catalog
        "<InfoCard title={t('card.yourCard.balanceDueTitle')} />",
        "<InfoCard description={t('balanceDueBody', { amount })} />",
        // template literals that interpolate values without prose around them
        '<InfoCard title={`$${(cents / 100).toFixed(2)}`} />',
        '<InfoCard title={`${a}${b}`} />',
        '<Row label={`${count}%`} />',
    ],
    invalid: [
        {
            code: '<InfoCard description="A recent card payment ended up higher than the amount held at checkout." />',
            errors: [{ messageId: 'literal' }],
        },
        {
            code: '<ActionModal title="A small update to our terms" />',
            errors: [{ messageId: 'literal' }],
        },
        {
            code: '<PaymentInfoRow label="Exchange Rate" />',
            errors: [{ messageId: 'literal' }],
        },
        {
            // the shape that shipped: prose with one interpolated amount
            code: '<InfoCard title={`${amount} will be debited based on your next deposit`} />',
            errors: [{ messageId: 'literal' }],
        },
        {
            // trailing interpolation still reads as prose
            code: '<button aria-label={`Dismiss ${title}`} />',
            errors: [{ messageId: 'literal' }],
        },
        {
            code: '<Field placeholder="Address to receive the funds" />',
            errors: [{ messageId: 'literal' }],
        },
        {
            // a string literal wrapped in braces is the same bug
            code: '<InfoCard description={"We could not load the exchange rate."} />',
            errors: [{ messageId: 'literal' }],
        },
    ],
})
