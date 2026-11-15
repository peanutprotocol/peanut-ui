'use client'

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { importWithChunkRetry } from '@/utils/chunk-error-recovery'
import type { AskId, InlineSurfaceProps } from './types'

export const INLINE_SURFACES: Partial<Record<AskId, LazyExoticComponent<ComponentType<InlineSurfaceProps>>>> = {
    'verification-deadline': lazy(() =>
        importWithChunkRetry(() => import('@/components/Kyc/VerificationDeadlineNotice'))
    ),
    'cap-nudge': lazy(() => importWithChunkRetry(() => import('./surfaces/CapNudgeSurface'))),
}
