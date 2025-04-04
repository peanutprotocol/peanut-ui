import { ScreenId, ScreenProps } from '@/components/Setup/Setup.types'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useCallback } from 'react'

export const useSetupFlow = () => {
    const dispatch = useAppDispatch()
    const { currentStep, direction, isLoading, steps } = useSetupStore()

    const step = steps[currentStep - 1]
    const isFirstStep = currentStep === 1
    const isLastStep = currentStep === steps.length

    const handleNext = useCallback(
        async (callback?: () => Promise<boolean>, screenId?: ScreenId) => {
            dispatch(setupActions.setLoading(true))

            try {
                if (callback) {
                    const isValid = await callback()
                    if (!isValid) return
                }

                if (screenId) {
                    // Find the step index for the given screenId and set it
                    const stepIndex = steps.findIndex((s) => s.screenId === screenId)
                    if (stepIndex !== -1) {
                        dispatch(setupActions.setStep(stepIndex + 1))
                    } else {
                        dispatch(setupActions.nextStep())
                    }
                } else {
                    dispatch(setupActions.nextStep())
                }
            } finally {
                dispatch(setupActions.setLoading(false))
            }
        },
        [steps]
    )

    const handleBack = useCallback(() => {
        dispatch(setupActions.previousStep())
    }, [dispatch])

    // Function to specifically set a screen by ID
    const setScreenId = useCallback(
        (screenId: ScreenId) => {
            const stepIndex = steps.findIndex((s) => s.screenId === screenId)
            if (stepIndex !== -1) {
                dispatch(setupActions.setStep(stepIndex + 1))
            }
        },
        [steps]
    )

    return {
        currentStep,
        direction,
        isFirstStep,
        isLastStep,
        isLoading,
        handleNext,
        handleBack,
        setScreenId,
        step,
    }
}
