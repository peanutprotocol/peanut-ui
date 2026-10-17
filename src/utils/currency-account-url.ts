import { parseAsString, parseAsStringEnum } from 'nuqs'

export const currencyAccountParsers = {
    currency: parseAsStringEnum(['USDC', 'EURC']).withDefault('USDC'),
    action: parseAsStringEnum(['RECEIVE', 'SEND', 'EXCHANGE', 'BANK_DEPOSIT', 'BANK_WITHDRAW']),
    operation: parseAsString,
}
