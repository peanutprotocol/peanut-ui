'use client'

import { useCapabilities } from '@/hooks/useCapabilities'
import { findPixRoute, pixPayBlock, type PixPayBlock } from '@/features/pix/pixRoute.utils'

/** What stops a Pix payment or a Pix-key send for this user, as the pay:PIX_BR route says (`pixPayBlock`). */
export function usePixPayBlock(): PixPayBlock | null {
    const { capabilities } = useCapabilities()
    return pixPayBlock(findPixRoute(capabilities.routes, 'pay'))
}
