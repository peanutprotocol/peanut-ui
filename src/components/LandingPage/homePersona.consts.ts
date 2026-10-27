import { STAR_LP_EARNERS } from '@/components/Marketing/StarLp/starLpPersonas.consts'
import type { HomePersonaKey } from './homePersona.types'

/**
 * The home persona fold's earners, in cycling order: payers in Europe and the
 * US take turns. Composites of the core ICP (product/icps.md), nameless, so no
 * real people. The first four wear the star LPs' earner stickers; the
 * photographer adds one more basic sticker.
 */
export const HOME_PERSONA_AVATARS: ReadonlyArray<{ key: HomePersonaKey; avatar: string }> = [
    { key: 'designer', avatar: STAR_LP_EARNERS.designer.avatar },
    { key: 'developer', avatar: STAR_LP_EARNERS.developer.avatar },
    { key: 'editor', avatar: STAR_LP_EARNERS.editor.avatar },
    { key: 'writer', avatar: STAR_LP_EARNERS.writer.avatar },
    { key: 'photographer', avatar: 'basic.star' },
]

/** How long each earner stays on show, ms: long enough to read one line twice. */
export const HOME_PERSONA_CYCLE_MS = 3200
