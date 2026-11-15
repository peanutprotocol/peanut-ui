/** Synthetic capture guard: no invalid numeric tokens in rendered UI or controls.
 * Do not include offending text in diagnostics: fixture data can contain secrets.
 * @param {{text?: string, inputs?: string[], sliderAttributes?: string[]}} snapshot
 */
export function hasInvalidNumericUi({ text = '', inputs = [], sliderAttributes = [] }) {
    const invalid = /\b(?:NaN|[+-]?Infinity)\b|[+-]?∞/u
    return [text, ...inputs, ...sliderAttributes].some((value) => invalid.test(value))
}
