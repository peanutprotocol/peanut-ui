'use client'

import PendingVerificationTasks from '@/components/Home/PendingVerificationTasks'
import type { ZoneSurfaceProps } from '../../types'

/** The due verification tasks; the component keeps its per-task dismissal fingerprints. */
export default function VerificationDueSurface(_: ZoneSurfaceProps) {
    return <PendingVerificationTasks placement="home" />
}
