// Kept out of the useCurrency hook so server code (the receipt PDF) can format
// amounts without importing React hooks.
export const SYMBOLS_BY_CURRENCY_CODE: Record<string, string> = {
    ARS: 'ARS',
    USD: '$',
    EUR: '€',
    MXN: 'MX$',
    BRL: 'R$',
    COP: 'Col$',
    CRC: '₡',
    BOB: '$b',
    PUSD: 'PUSD',
    GTQ: 'Q',
    PHP: '₱',
    GBP: '£',
    JPY: '¥',
    CAD: 'CA$',
}
