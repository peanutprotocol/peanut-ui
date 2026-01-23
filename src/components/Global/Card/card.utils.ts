export type CardPosition = 'single' | 'first' | 'middle' | 'last'

export function getCardPosition(index: number, totalItems: number): CardPosition {
    if (totalItems === 1) return 'single'
    if (index === 0) return 'first'
    if (index === totalItems - 1) return 'last'
    return 'middle'
}
