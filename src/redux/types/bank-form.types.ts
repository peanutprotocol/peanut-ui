import { type IBankAccountDetails } from '@/components/AddWithdraw/DynamicBankAccountForm'

export type BankFormFlow = 'claim' | 'withdraw'

export interface IBankFormState {
    formData: Partial<IBankAccountDetails> | null
}
