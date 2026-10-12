'use client'

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { AskId, BannerSurfaceProps } from './types'

export const BANNER_SURFACES: Partial<Record<AskId, LazyExoticComponent<ComponentType<BannerSurfaceProps>>>> = {
    maintenance: lazy(() => import('./surfaces/MaintenanceSurface')),
}
