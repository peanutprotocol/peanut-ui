import { type IBankAccountDetails } from '@/components/AddWithdraw/DynamicBankAccountForm'

export interface IBankFormState {
    formData: Partial<IBankAccountDetails> | null
}
