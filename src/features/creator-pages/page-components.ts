import type { ComponentType } from 'react'
import { NitaA1 } from './pages/juanacervio/NitaA1'
import { NitaE1 } from './pages/juanacervio/NitaE1'
import { NitaG2 } from './pages/juanacervio/NitaG2'
import type { CreatorPageVariantProps } from './variant-props'

type CreatorPageComponent = ComponentType<CreatorPageVariantProps>

/** The component of every variant in experiments.ts: username → variant id → page. A test keeps the two files in step. */
export const CREATOR_PAGE_COMPONENTS: Record<string, Record<string, CreatorPageComponent>> = {
    juanacervio: { a1: NitaA1, g2: NitaG2, e1: NitaE1 },
}

export function creatorPageComponent(username: string, variantId: string): CreatorPageComponent | null {
    if (!Object.hasOwn(CREATOR_PAGE_COMPONENTS, username)) return null
    const pages = CREATOR_PAGE_COMPONENTS[username]
    return Object.hasOwn(pages, variantId) ? pages[variantId] : null
}
