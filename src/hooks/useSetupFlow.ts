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
        async <T extends ScreenId>(callback?: () => Promise<boolean>, _props?: ScreenProps[T]) => {
            dispatch(setupActions.setLoading(true))

            try {
                if (callback) {
                    const isValid = await callback()
                    if (!isValid) return
                }

                dispatch(setupActions.nextStep())
            } finally {
                dispatch(setupActions.setLoading(false))
            }
        },
        []
    )

    const handleBack = useCallback(() => {
        dispatch(setupActions.previousStep())
    }, [])

    return {
        currentStep,
        direction,
        isFirstStep,
        isLastStep,
        isLoading,
        handleNext,
        handleBack,
        step,
    }
}
