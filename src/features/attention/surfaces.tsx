'use client'

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { AskId, AskSurfaceProps } from './types'

type Surface = LazyExoticComponent<ComponentType<AskSurfaceProps>>

/**
 * Which component renders each ask's interrupt. Lazy: a modal is 20–30 KB
 * and most sessions open none. Every ask with an `interrupt` surface in the
 * registry needs an entry here (a parity test pins it).
 */
export const INTERRUPT_SURFACES: Partial<Record<AskId, Surface>> = {
    'legal-reconsent': lazy(() => import('./surfaces/LegalReconsentSurface')),
    arrival: lazy(() => import('@/features/home/components/ArrivalDrawer')),
    'balance-backup': lazy(() => import('./surfaces/BalanceBackupSurface')),
    'post-verification-action': lazy(() => import('@/components/Global/PostSignupActionManager')),
    'finish-card-setup': lazy(() => import('@/components/Home/EnableAutoBalanceBanner')),
    'install-app': lazy(() => import('@/components/Migration/MigrationDownloadModal')),
    'push-home-fallback': lazy(() => import('./surfaces/HomePushPrompt')),
    'early-user': lazy(() => import('@/components/Global/EarlyUserDrawer')),
}
