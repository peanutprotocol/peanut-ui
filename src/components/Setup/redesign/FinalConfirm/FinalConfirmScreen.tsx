'use client'

import SignTestTransaction from '@/components/Setup/Views/SignTestTransaction'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'

export type FinalConfirmScreenProps = {
    /** Called once the account is set up; the step then shows the celebration. */
    onComplete?: () => void
    /** `/setup/finish` (a signed-in user who never finished): a "Log out" link under the button. */
    showLogout?: boolean
}

/**
 * 11 Final confirm (step `advantage-control` before sign-up completes, and `/setup/finish`). PLACEHOLDER from the
 * foundation: the mock's ground and stage on the new shell, with dev's view as the panel body so the flow keeps
 * working. Package P4 replaces this file's body; keep the name and the props. Contract: mono
 * _temp/signup-redesign/r2/r9/build/INTERFACES.md.
 */
export function FinalConfirmScreen({ onComplete, showLogout }: FinalConfirmScreenProps) {
    return (
        <SetupScreen ground="sky" stage="std" footer={null} state="default" panelClassName="overflow-y-auto pb-6">
            {showLogout ? <SignTestTransaction showLogout /> : <SignTestTransaction merged onComplete={onComplete} />}
        </SetupScreen>
    )
}
