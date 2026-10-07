import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import SignTestTransaction from './SignTestTransaction'
import { useSetupFullScreen } from '../components/SetupWrapper'
import SuccessStep from './Success'

/** One final signup screen: confirm the account, then celebrate its completion. */
export default function CompleteSignupStep({ onComplete }: { onComplete?: () => void }) {
    const { signupCompleted } = useSetupFlowContext()
    useSetupFullScreen(signupCompleted)
    return signupCompleted ? <SuccessStep /> : <SignTestTransaction merged onComplete={onComplete} />
}
