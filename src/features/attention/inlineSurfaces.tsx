'use client'

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { AskId, InlineSurfaceProps } from './types'

export const INLINE_SURFACES: Partial<Record<AskId, LazyExoticComponent<ComponentType<InlineSurfaceProps>>>> = {
    'verification-deadline': lazy(() => import('@/components/Kyc/VerificationDeadlineNotice')),
    'cap-nudge': lazy(() => import('./surfaces/CapNudgeSurface')),
}
