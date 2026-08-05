/**
 * Presentation metadata for the in-app surface taxonomy: the label, colour and
 * plain-language explanation behind each `SurfaceKind` chip. Kept apart from
 * journeyData.ts, which holds the surfaces themselves.
 */

import type { DevChipTone } from '../_components/devChipTones'
import type { SurfaceKind } from './journeyTypes'

export interface SurfaceKindMeta {
    label: string
    tone: DevChipTone
    /** What this kind of surface actually is, for the legend and chip tooltips. */
    description: string
}

/** Legend order — roughly how early in the funnel each kind first appears. */
export const SURFACE_KIND_ORDER: SurfaceKind[] = ['step', 'carousel', 'modal', 'card-screen']

export const SURFACE_KIND_META: Record<SurfaceKind, SurfaceKindMeta> = {
    step: {
        label: 'home step',
        tone: 'yellow',
        description: 'The single activation step card on /home — one step at a time, picked by useActivationStatus.',
    },
    carousel: {
        label: 'carousel',
        tone: 'lavender',
        description: 'A card in the /home carousel, shown to already-activated users and dismissable for 7 days.',
    },
    modal: {
        label: 'modal',
        tone: 'pink',
        description: 'A modal, sheet or celebration toast layered over whatever screen the user is already on.',
    },
    'card-screen': {
        label: '/card',
        tone: 'green',
        description: 'A full-screen state of the /card route, selected by computeCardState precedence.',
    },
}
