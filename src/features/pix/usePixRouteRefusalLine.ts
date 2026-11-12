'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { pixRefusalCopy } from '@/features/pix/pixRoute.utils'
import type { CapabilityRoute } from '@/types/capabilities'

/**
 * The line that explains a refused Pix route, wherever one is shown: the Pix pages and the BRL
 * row's drawer word it the same. A reason this build knows reads in the user's language; any other
 * reads as the route's own message.
 */
export function usePixRouteRefusalLine(): (reason: CapabilityRoute['reason']) => string {
    const t = useTranslations()
    return useCallback(
        (reason: CapabilityRoute['reason']) =>
            ({
                rejected: t('pix.rejected'),
                'setup-failed': t('pix.setup.notAvailable'),
                residence: t('pix.residenceNotServed'),
                'not-yet': t('pix.rolloutClosed'),
                down: t('pix.unavailable'),
                'not-served': t('pix.methodNotServed'),
                reason: reason?.userMessage ?? '',
            })[pixRefusalCopy(reason)],
        [t]
    )
}
