'use client'

import SuccessStep from '@/components/Setup/Views/Success'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'

/**
 * 12 Celebration (step `advantage-control` after sign-up completes). PLACEHOLDER from the foundation: the mock's
 * ground and chrome on the new shell, with dev's view as the panel body so the claim-link redirect and the exit
 * keep working. The mock's stage is 'full' (no panel); the placeholder keeps a panel for dev's view. Package P4
 * replaces this file's body; keep the name. Contract: mono _temp/signup-redesign/r2/r9/build/INTERFACES.md.
 */
export function CelebrationScreen() {
    return (
        <SetupScreen
            ground="pink"
            stage="compact"
            chrome={{ back: false, dots: false, lang: false }}
            footer={null}
            state="default"
            panelClassName="overflow-y-auto pb-6"
        >
            <SuccessStep />
        </SetupScreen>
    )
}
