import { captureMessage } from '@/utils/sentry-lazy'

export type NumericSource = 'money' | 'rate' | 'format' | 'input' | 'submission'
export type NumericCategory = 'missing' | 'malformed' | 'nonfinite' | 'nonpositive' | 'precision' | 'unit' | 'overflow'

const sources: readonly string[] = ['money', 'rate', 'format', 'input', 'submission']
const categories: readonly string[] = [
    'missing',
    'malformed',
    'nonfinite',
    'nonpositive',
    'precision',
    'unit',
    'overflow',
]
// Exactly 5 × 7 possible keys. No raw input, user identity or URL is retained.
const reported = new Set<string>()

export function reportInvalidNumeric(source: NumericSource, category: NumericCategory): void {
    if (!sources.includes(source) || !categories.includes(category)) return
    const key = `${source}:${category}`
    if (reported.has(key)) return
    reported.add(key)
    try {
        captureMessage('Invalid numeric value', {
            level: 'warning',
            tags: { numeric_source: source, numeric_category: category },
            fingerprint: ['invalid_numeric', source, category],
        })
    } catch {
        // Diagnostics must never interrupt input, rendering or recovery.
    }
}
