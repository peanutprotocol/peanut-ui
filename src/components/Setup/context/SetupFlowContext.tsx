import { createContext, useContext, useState, ReactNode } from 'react'
import { ScreenId, ScreenProps, Step } from '../Setup.types'

interface SetupFlowContextType {
    currentStep: number
    direction: number
    isFirstStep: boolean
    isLastStep: boolean
    isLoading: boolean
    handleNext: <T extends ScreenId>(callback?: () => Promise<boolean>, props?: ScreenProps[T]) => Promise<void>
    handleBack: () => void
    step: Step
    screenProps: ScreenProps[ScreenId] | undefined
}

interface SetupFlowProviderProps {
    children: ReactNode
    onComplete?: () => void
    steps: Step[]
}

const SetupFlowContext = createContext<SetupFlowContextType | null>(null)

export const SetupFlowProvider = ({ children, onComplete, steps }: SetupFlowProviderProps) => {
    const [currentStep, setCurrentStep] = useState(1)
    const [direction, setDirection] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const [screenProps, setScreenProps] = useState<ScreenProps[ScreenId]>()

    const isFirstStep = currentStep === 1
    const isLastStep = currentStep === steps.length
    const step = steps[currentStep - 1]

    /**
     * Notice: Callers of this function should handle errors themselves
     * @param callback Should return a boolean indicating the step logic was successful
     * @param props
     * @returns
     */
    const handleNext = async <T extends ScreenId>(callback?: () => Promise<boolean>, props?: ScreenProps[T]) => {
        setIsLoading(true)

        try {
            if (callback) {
                const isValid = await callback()
                if (!isValid) return
            }

            setScreenProps(props)
            setDirection(1)
            setCurrentStep((prev) => Math.min(steps.length, prev + 1))

            if (isLastStep) {
                onComplete?.()
                return
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleBack = () => {
        setDirection(-1)
        setCurrentStep((prev) => Math.max(1, prev - 1))
    }

    return (
        <SetupFlowContext.Provider
            value={{
                currentStep,
                direction,
                isFirstStep,
                isLastStep,
                isLoading,
                handleNext,
                handleBack,
                step,
                screenProps,
            }}
        >
            {children}
        </SetupFlowContext.Provider>
    )
}

export const useSetupFlow = () => {
    const context = useContext(SetupFlowContext)
    if (!context) {
        throw new Error('useSetupFlow must be used within a SetupFlowProvider')
    }
    return context
}
