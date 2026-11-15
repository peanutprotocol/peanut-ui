'use client'

import { useTranslations } from 'next-intl'
import type { PixPayBlock } from '@/features/pix/pixRoute.utils'

/**
 * The drawer's and the screen's words for a blocked Pix payment: the Brazil pause, a provider paused
 * for everyone (the Pix pages' outage line, not the pause of Brazil's residents), or the residence.
 */
export function usePixPayBlockCopy(block: PixPayBlock): { title: string; body: string } {
    const tPause = useTranslations('brazilPause')
    const tPix = useTranslations('pix')
    if (block === 'paused') return { title: tPause('title'), body: tPause('body') }
    if (block === 'outage') return { title: tPix('unavailableTitle'), body: tPix('unavailable') }
    return { title: tPix('unavailableTitle'), body: tPix('payResidence') }
}
