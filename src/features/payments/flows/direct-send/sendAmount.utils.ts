export type AmountKey = 'delete' | 'decimal' | `${number}`

const MAX_WHOLE_DIGITS = 10

export function pressAmountKey(current: string, key: AmountKey): string {
    if (key === 'delete') return current.slice(0, -1)
    if (key === 'decimal') return current.includes('.') ? current : `${current || '0'}.`

    const value = current === '0' || current === '0.00' ? '' : current
    const [whole, fraction] = value.split('.')
    if (fraction !== undefined && fraction.length >= 2) return value
    if (fraction === undefined && whole.replace(/^0+/, '').length >= MAX_WHOLE_DIGITS) return value
    return `${value}${key}`
}

export function formatSendAmount(value: string): string {
    if (!value) return '$0'
    const [whole, fraction] = value.split('.')
    const grouped = Number(whole || 0).toLocaleString('en-US')
    return `$${grouped}${fraction === undefined ? '' : `.${fraction}`}`
}

/** Only a standalone, positive USD amount is offered as a clipboard shortcut. */
export function parseClipboardAmount(text: string): string | null {
    const trimmed = text.trim()
    if (!/^(?:USD\s*|\$\s*)?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/i.test(trimmed)) return null
    const value = trimmed.replace(/^(?:USD\s*|\$\s*)/i, '').replaceAll(',', '')
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0 || value.split('.')[0].length > MAX_WHOLE_DIGITS) return null
    return value
}

export const COMMENT_EMOJIS = [
    '🚗💕',
    '🎁',
    '💸',
    '🫶',
    '🥰',
    '💖',
    '💌',
    '🧸',
    '🍓',
    '🍕',
    '☕',
    '🎉',
    '🌈',
    '✨',
    '🚀',
    '🏡',
    '🌸',
    '💰',
] as const

export function pickCommentEmojis(random: () => number = Math.random): string[] {
    const options: string[] = [...COMMENT_EMOJIS]
    for (let i = options.length - 1; i > options.length - 4; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[options[i], options[j]] = [options[j], options[i]]
    }
    return options.slice(-3)
}
