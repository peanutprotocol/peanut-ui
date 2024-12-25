import { ISetupStep } from '@/components/Setup/Setup.types'

export interface ISetupState {
    handle: string
    currentStep: number
    direction: number
    isLoading: boolean
    steps: ISetupStep[]
}
