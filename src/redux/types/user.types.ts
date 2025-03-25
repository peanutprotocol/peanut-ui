import { IUserProfile } from '@/interfaces'

export type TPaymentView = 'INITIAL' | 'CONFIRM' | 'STATUS'

export interface IAuthState {
    user: IUserProfile | null
}
