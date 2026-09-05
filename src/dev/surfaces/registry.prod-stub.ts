/**
 * Build-time replacement for the surfaces registry.
 *
 * The /dev/surfaces route cannot answer outside development and previews, but a
 * dynamic import still makes webpack/turbopack emit a chunk for the registry and
 * the ~50 app components it mounts. next.config.js aliases the registry to this
 * stub whenever DEV_TOOLS_ENABLED would be false, so production and native
 * exports carry the empty shape instead of the gallery.
 */

import type React from 'react'
import type { SurfaceMeta } from './list'

export type Surface = SurfaceMeta & {
    render?: () => React.ReactNode
    modalsContextFlag?: 'signIn' | 'support' | 'iosPwaInstall'
}

export const SURFACES: Record<string, Surface> = {}
export const OPTION_SURFACES: Record<string, { name: string; render: () => React.ReactNode }> = {}
export const SURFACE_IDS: string[] = []
