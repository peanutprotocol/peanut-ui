'use client'

/**
 * Inventory of the reward / celebration / achievement overlays (TASK-22680).
 *
 * Same gate as /dev/surfaces: DEV_TOOLS_ENABLED plus a dynamic import, so the
 * dev-only body never enters a production build or the native static export.
 */

import dynamic from 'next/dynamic'
import { notFound } from 'next/navigation'
import { DEV_TOOLS_ENABLED } from '@/constants/dev-tools.consts'

const RewardSurfaces = DEV_TOOLS_ENABLED ? dynamic(() => import('@/dev/reward-surfaces/RewardSurfaces')) : null

export default function DevRewardSurfacesPage() {
    // gate outside the component that calls hooks, or rules-of-hooks fails lint
    if (!RewardSurfaces) notFound()
    return <RewardSurfaces />
}
