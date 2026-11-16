'use client'

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { importWithChunkRetry } from '@/utils/chunk-error-recovery'
import type { AskId, ZoneSurfaceProps } from './types'

type Surface = LazyExoticComponent<ComponentType<ZoneSurfaceProps>>

/** Which component renders each ask's Home card. Every ask with a `zone` surface needs an entry (parity test). */
export const ZONE_SURFACES: Partial<Record<AskId, Surface>> = {
    'app-update-regular': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/AppUpdateCard'))),
    'verification-due': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/VerificationDueSurface'))),
    'blocked-card': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/ChecklistSurface'))),
    checklist: lazy(() => importWithChunkRetry(() => import('./surfaces/zone/ChecklistSurface'))),
    'install-app': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/InstallAppCard'))),
    'verification-advisory': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/DocumentRequestCard'))),
    'qr-payment': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/QrPaymentCard'))),
    'verify-for-qr': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/VerifyForQrCard'))),
    'card-offer': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/CardOfferCard'))),
    'push-home-fallback': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/PushCard'))),
    invite: lazy(() => importWithChunkRetry(() => import('./surfaces/zone/InviteCard'))),
    'bug-bounty': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/BugBountyCard'))),
    'user-interview': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/UserInterviewCard'))),
    'virtual-account': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/VirtualAccountCard'))),
    'next-payment': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/NextPaymentCard'))),
    'share-bank-details': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/ShareBankDetailsCard'))),
    'request-money': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/RequestMoneyCard'))),
    'send-money': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/SendMoneyCard'))),
    'backup-passkey': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/BackupPasskeyCard'))),
    'add-email': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/AddEmailCard'))),
    rewards: lazy(() => importWithChunkRetry(() => import('./surfaces/zone/RewardsCard'))),
    'complete-profile': lazy(() => importWithChunkRetry(() => import('./surfaces/zone/CompleteProfileCard'))),
}
