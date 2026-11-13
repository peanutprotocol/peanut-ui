'use client'

import { useCapabilities } from '@/hooks/useCapabilities'
import { findPixRoute, pixKeySend, type PixKeySend } from '@/features/pix/pixRoute.utils'
import { usePixPayBlock } from '@/features/pix/usePixPayBlock'

/** How Send pays a Pix key for this user: the pay route's block and the withdraw:PIX_BR route (`pixKeySend`). */
export function usePixKeySend(): PixKeySend {
    const payBlock = usePixPayBlock()
    const { capabilities } = useCapabilities()
    // the withdraw route matters only where the pay route refuses the residence
    const withdrawRoute = payBlock === 'residence' ? findPixRoute(capabilities.routes, 'withdraw') : undefined
    return pixKeySend(payBlock, withdrawRoute)
}
