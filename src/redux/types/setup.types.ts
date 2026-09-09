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
    showIosPwaInstallScreen: boolean
    /** ISO-2 legal-residence country declared on the residence step ('' until chosen). */
    residenceCountry: string
    /** ISO-2 second country, revealed by "Have documents from more than one country?". */
    secondResidenceCountry: string
}
