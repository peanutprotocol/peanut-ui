export type CardPosition = 'solo' | 'top' | 'middle' | 'bottom'

export function getCardPosition(index: number, totalItems: number): CardPosition {
    if (totalItems === 1) return 'solo'
    if (index === 0) return 'top'
    if (index === totalItems - 1) return 'bottom'
    return 'middle'
}
