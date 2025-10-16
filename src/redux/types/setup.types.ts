import { type ISetupStep } from '@/components/Setup/Setup.types'
import { EInviteType } from '@/services/services.types'

export interface ISetupState {
    username: string
    currentStep: number
    direction: number
    isLoading: boolean
    steps: ISetupStep[]
    telegramHandle: string
    inviteCode: string
    inviteType: EInviteType
}
