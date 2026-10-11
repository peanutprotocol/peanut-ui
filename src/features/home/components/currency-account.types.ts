import type { ComponentProps, ReactNode } from 'react'
import type { BalanceSection } from '../views/BalanceSection'

export type CurrencyAccountsHomeProps = {
    balanceProps: ComponentProps<typeof BalanceSection>
    children: ReactNode
}

export type CurrencyMoneyForm = { amount: string; recipient: string; bank: string; source: 'EURC' | 'USDC' }

export type CurrencyMoneyFormProps = {
    userId: string
    kind: import('@/services/currency-accounts').CurrencyOperationKind
    onPrepared: (operation: import('@/services/currency-accounts').CurrencyOperation) => void
    onClose: () => void
}

export type CurrencyAccountFlowState = {
    action: 'RECEIVE' | 'SEND' | 'EXCHANGE' | 'BANK_DEPOSIT' | 'BANK_WITHDRAW' | null
    operation: string | null
}
