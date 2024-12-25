import { ISetupStep, ScreenId, ScreenProps } from '@/components/Setup/Setup.types'

export interface ISetupState {
    currentStep: number
    direction: number
    isLoading: boolean
    screenProps?: ScreenProps[ScreenId]
    steps: ISetupStep[]
}
