'use client'

import type { ComponentProps } from 'react'
import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import { ClaimAccountContent } from './ClaimAccountContent'

export function ClaimAccountScreen(props: ComponentProps<typeof ClaimAccountContent>) {
    return (
        <KycFeatureActivationGate feature="bank" scope={{ channel: 'bank', method: props.rail.corridor }}>
            <ClaimAccountContent {...props} />
        </KycFeatureActivationGate>
    )
}
