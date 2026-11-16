'use client'

import PaymentPlanStep from '@/components/Setup/Views/PaymentPlan'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'

/**
 * 08 Payment plan (step `payment-plan`). PLACEHOLDER from the foundation: the mock's ground, stage on the new shell, with
 * dev's view as the panel body so the flow keeps working. Package P3 replaces this file's body; keep the name
 * and the props. Contract: mono _temp/signup-redesign/r2/r9/build/INTERFACES.md.
 */
export function PaymentPlanScreen(_props: StepComponentProps) {
    return (
        <SetupScreen ground="sky" stage="std" footer={null} state="default" panelClassName="overflow-y-auto pb-6">
            <PaymentPlanStep />
        </SetupScreen>
    )
}
