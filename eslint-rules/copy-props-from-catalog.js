/**
 * Copy handed to a component as a PROP must come from next-intl.
 *
 * `react/jsx-no-literals` runs with `ignoreProps: true` — it cannot be flipped,
 * since every non-copy prop (`variant="warning"`, `icon="info"`, `type="button"`)
 * is a string literal too. That blind spot shipped English to every locale from
 * screens that were otherwise fully translated: the card balance-due notice and
 * the card-receipt adjustment notice both passed `title`/`description` as
 * literals on a page where all other copy went through `t()`.
 *
 * Only props that carry prose are checked, and only values that look like prose
 * (two or more words), so ids, slugs, enum-ish values and single tokens like
 * `label="USD"` stay legal.
 */

const COPY_PROPS = new Set([
    'title',
    'description',
    'subtitle',
    'heading',
    'placeholder',
    'label',
    'ariaLabel',
    'aria-label',
    'message',
    'cta',
    'caption',
    'helperText',
    'emptyMessage',
])

// Two adjacent words: the cheapest signal that separates prose from a token.
// Deliberately not anchored — "Add money to your account" and "Razón Social"
// both match, "USD", "peanut.me/" and "card-terms-us" do not.
const PROSE = /[\p{L}]\s+[\p{L}]/u

const MESSAGE =
    "Copy passed as `{{prop}}` must come from next-intl, not a literal — react/jsx-no-literals only inspects JSX children, so prop copy reaches every locale in English. Use t('…') from the right namespace. If this string is not copy (an id, a slug, a currency code), it does not need to be a full phrase."

module.exports = {
    meta: {
        type: 'problem',
        docs: { description: 'require next-intl for copy passed as a JSX prop' },
        schema: [],
        messages: { literal: MESSAGE },
    },
    create(context) {
        const report = (node, prop) => context.report({ node, messageId: 'literal', data: { prop } })

        return {
            JSXAttribute(node) {
                const name = node.name && node.name.type === 'JSXIdentifier' ? node.name.name : null
                if (!name || !COPY_PROPS.has(name)) return
                const value = node.value
                if (!value) return

                if (value.type === 'Literal') {
                    if (typeof value.value === 'string' && PROSE.test(value.value)) report(value, name)
                    return
                }
                if (value.type !== 'JSXExpressionContainer') return

                const expression = value.expression
                if (expression.type === 'Literal') {
                    if (typeof expression.value === 'string' && PROSE.test(expression.value)) report(expression, name)
                    return
                }
                // Template literals are the other half of the bug: the card notices
                // interpolated an amount into an otherwise-hardcoded sentence. Each
                // interpolation stands in as one word, so `Dismiss ${name}` reads as
                // prose while `$${amount}` and `${a}${b}` do not.
                if (expression.type === 'TemplateLiteral') {
                    const asWords = expression.quasis.map((quasi) => quasi.value.raw).join('X')
                    if (PROSE.test(asWords)) report(expression, name)
                }
            },
        }
    },
}
