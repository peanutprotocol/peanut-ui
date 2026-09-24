export type AmountKey = 'delete' | 'decimal' | `${number}`

const MAX_WHOLE_DIGITS = 10

export function pressAmountKey(current: string, key: AmountKey, maxDecimals = 2): string {
    const value = current.replaceAll(',', '')
    if (key === 'delete') return value.slice(0, -1)
    if (key === 'decimal') return maxDecimals === 0 || value.includes('.') ? value : `${value || '0'}.`

    const editable = value === '0' || /^0\.0+$/.test(value) ? '' : value
    const [whole, fraction] = editable.split('.')
    if (fraction !== undefined && fraction.length >= maxDecimals) return editable
    if (fraction === undefined && whole.replace(/^0+/, '').length >= MAX_WHOLE_DIGITS) return editable
    return `${editable}${key}`
}

export function formatKeypadAmount(value: string, symbol: string): string {
    const [whole, fraction] = value.replaceAll(',', '').split('.')
    const grouped = Number(whole || 0).toLocaleString('en-US')
    const amount = `${grouped}${fraction === undefined ? '' : `.${fraction}`}`
    return `${symbol}${symbol.length > 1 ? ' ' : ''}${amount}`
}
