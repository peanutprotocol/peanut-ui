'use client'

import { useTranslations } from 'next-intl'
import { useCapabilities } from '@/hooks/useCapabilities'
import { findPixRoute, type PixPayBlock } from '@/features/pix/pixRoute.utils'

/**
 * The drawer's and the screen's words for a blocked Pix payment: the Brazil pause, or the residence.
 * A resident whose Pix withdraw route is ready can still pay a Pix key, as a payout to that key
 * (`pixKeySend`, TASK-24910), so the residence block adds that line (`keySend`); null otherwise.
 */
export function usePixPayBlockCopy(block: PixPayBlock): { title: string; body: string; keySend: string | null } {
    const tPause = useTranslations('brazilPause')
    const tPix = useTranslations('pix')
    const { capabilities } = useCapabilities()
    if (block === 'paused') return { title: tPause('title'), body: tPause('body'), keySend: null }
    const sendsToKey = findPixRoute(capabilities.routes, 'withdraw')?.state === 'ready'
    return {
        title: tPix('unavailableTitle'),
        body: tPix('payResidence'),
        keySend: sendsToKey ? tPix('payResidenceKeySend') : null,
    }
}
