'use client'

/**
 * One surface per page load, open, so the visual-shot harness can photograph
 * every modal and drawer in the content-taxonomy review without walking the
 * flows that normally open them. `/dev/surfaces?s=<id>`; no `s` lists the ids.
 *
 * The registry is loaded behind DEV_TOOLS_ENABLED with a dynamic import — the
 * same shape /dev/fixtures uses. A static import would pull the registry and
 * every app component it mounts into this route's graph, so a production build
 * and the native static export would carry the whole dev-only chunk even though
 * the route cannot answer.
 */

import dynamic from 'next/dynamic'
import { notFound } from 'next/navigation'
import { DEV_TOOLS_ENABLED } from '@/constants/dev-tools.consts'

const SurfaceGallery = DEV_TOOLS_ENABLED ? dynamic(() => import('@/dev/surfaces/SurfaceGallery')) : null

export default function DevSurfacesPage() {
    // gate outside the component that calls hooks, or rules-of-hooks fails lint
    if (!SurfaceGallery) notFound()
    return <SurfaceGallery />
}
