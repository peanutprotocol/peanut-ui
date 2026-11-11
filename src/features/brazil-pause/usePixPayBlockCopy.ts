'use client'

import { useTranslations } from 'next-intl'
import type { PixPayBlock } from '@/features/pix/pixRoute.utils'

/** The drawer's and the screen's words for a blocked Pix payment: the Brazil pause, or the residence. */
export function usePixPayBlockCopy(block: PixPayBlock): { title: string; body: string } {
    const tPause = useTranslations('brazilPause')
    const tPix = useTranslations('pix')
    return block === 'paused'
        ? { title: tPause('title'), body: tPause('body') }
        : { title: tPix('unavailableTitle'), body: tPix('payResidence') }
}
