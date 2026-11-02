'use client'

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { importWithChunkRetry } from '@/utils/chunk-error-recovery'
import type { AskId, AskSurfaceProps } from './types'

type Surface = LazyExoticComponent<ComponentType<AskSurfaceProps>>

/**
 * Which component renders each ask's interrupt. Lazy: a modal is 20–30 KB
 * and most sessions open none. Every ask with an `interrupt` surface in the
 * registry needs an entry here (a parity test pins it).
 */
export const INTERRUPT_SURFACES: Partial<Record<AskId, Surface>> = {
    'legal-reconsent': lazy(() => importWithChunkRetry(() => import('./surfaces/LegalReconsentSurface'))),
    'balance-backup': lazy(() => importWithChunkRetry(() => import('./surfaces/BalanceBackupSurface'))),
    'post-verification-action': lazy(() =>
        importWithChunkRetry(() => import('@/components/Global/PostSignupActionManager'))
    ),
    'finish-card-setup': lazy(() => importWithChunkRetry(() => import('@/components/Home/EnableAutoBalanceBanner'))),
    'finish-card-funding': lazy(() => importWithChunkRetry(() => import('@/components/Home/FundingSetupPrompt'))),
    'install-app': lazy(() => importWithChunkRetry(() => import('@/components/Migration/MigrationDownloadModal'))),
    'push-home-fallback': lazy(() => importWithChunkRetry(() => import('./surfaces/HomePushPrompt'))),
    'early-user': lazy(() => importWithChunkRetry(() => import('@/components/Global/EarlyUserDrawer'))),
}
