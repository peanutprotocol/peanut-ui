import { type ISetupStep } from '@/components/Setup/Setup.types'
import { useBackHandler } from '@/hooks/useBackHandler'
import { minimizeNativeApp } from '@/utils/capacitor'

/**
 * Hardware back inside /setup walks the step's own back button or minimizes
 * the app; it never yields to router.back(), which bounced the user through
 * the flow's mirrored history entries.
 */
export function useSetupBackHandler({
    step,
    canStepBack,
    onBack,
}: {
    step: ISetupStep | undefined
    canStepBack: boolean
    onBack: () => void
}) {
    useBackHandler(() => {
        if (canStepBack && step?.showBackButton) onBack()
        else void minimizeNativeApp()
        return true
    })
}
