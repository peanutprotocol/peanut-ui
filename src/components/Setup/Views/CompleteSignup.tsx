import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import SignTestTransaction from './SignTestTransaction'
import SuccessStep from './Success'

/** One final signup screen: confirm the account, then celebrate its completion. */
export default function CompleteSignupStep({ onComplete }: { onComplete?: () => void }) {
    const { signupCompleted } = useSetupFlowContext()
    return signupCompleted ? <SuccessStep /> : <SignTestTransaction onComplete={onComplete} />
}
