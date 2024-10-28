import { createContext, useContext, useState, ReactNode } from 'react'

export type Step = {
    id: number
    title: string
    description?: string
    containerClassname: HTMLDivElement['className']
    component: () => JSX.Element
}

interface SetupFlowContextType {
    currentStep: number
    direction: number
    isFirstStep: boolean
    isLastStep: boolean
    isLoading: boolean
    handleNext: (businessLogic?: Promise<void>) => Promise<void>
    handleBack: () => void
    step: Step
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

    const isFirstStep = currentStep === 1
    const isLastStep = currentStep === steps.length
    const step = steps[currentStep - 1]

    const handleNext = async (businessLogic?: Promise<void>) => {
        try {
            setIsLoading(true)

            if (businessLogic) {
                await businessLogic
            }

            if (isLastStep) {
                onComplete?.()
                return
            }

            setDirection(1)
            setCurrentStep((prev) => Math.min(steps.length, prev + 1))
        } catch (error) {
            console.error('Error in handleNext:', error)
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
