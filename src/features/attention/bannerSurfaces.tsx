'use client'

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { importWithChunkRetry } from '@/utils/chunk-error-recovery'
import type { AskId, BannerSurfaceProps } from './types'

export const BANNER_SURFACES: Partial<Record<AskId, LazyExoticComponent<ComponentType<BannerSurfaceProps>>>> = {
    maintenance: lazy(() => importWithChunkRetry(() => import('./surfaces/MaintenanceSurface'))),
}
