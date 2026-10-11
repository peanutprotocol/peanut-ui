'use client'

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { AskId, ZoneSurfaceProps } from './types'

type Surface = LazyExoticComponent<ComponentType<ZoneSurfaceProps>>

/** Which component renders each ask's Home card. Every ask with a `zone` surface needs an entry (parity test). */
export const ZONE_SURFACES: Partial<Record<AskId, Surface>> = {
    'verification-due': lazy(() => import('./surfaces/zone/VerificationDueSurface')),
    'blocked-card': lazy(() => import('./surfaces/zone/ChecklistSurface')),
    checklist: lazy(() => import('./surfaces/zone/ChecklistSurface')),
    'install-app': lazy(() => import('./surfaces/zone/InstallAppCard')),
    'verification-advisory': lazy(() => import('./surfaces/zone/DocumentRequestCard')),
    'qr-payment': lazy(() => import('./surfaces/zone/QrPaymentCard')),
    'verify-for-qr': lazy(() => import('./surfaces/zone/VerifyForQrCard')),
    'card-offer': lazy(() => import('./surfaces/zone/CardOfferCard')),
    'push-home-fallback': lazy(() => import('./surfaces/zone/PushCard')),
    invite: lazy(() => import('./surfaces/zone/InviteCard')),
    'bug-bounty': lazy(() => import('./surfaces/zone/BugBountyCard')),
    'user-interview': lazy(() => import('./surfaces/zone/UserInterviewCard')),
}
