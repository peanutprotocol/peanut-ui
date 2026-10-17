export type CurrencyBalanceNoticeProps = {
    currency: 'USDC' | 'EURC'
    amount: string
    showSelectedBalance?: boolean
    availableBalance?: bigint
}
