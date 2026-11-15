'use client'

import PendingVerificationTasks from '@/components/Home/PendingVerificationTasks'
import { useAttentionOptional } from '../../AttentionProvider'
import type { ZoneSurfaceProps } from '../../types'

/** The due verification tasks; the component keeps its per-task dismissal fingerprints. */
export default function VerificationDueSurface(_: ZoneSurfaceProps) {
    const attention = useAttentionOptional()
    return (
        <PendingVerificationTasks
            placement="home"
            prioritizeIdentityRestart={attention?.state.prioritizeIdentityRestart}
        />
    )
}
