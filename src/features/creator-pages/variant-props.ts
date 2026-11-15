import type { CreatorPageProps } from '@/features/tracked-links/contract'
import type { DeviceOs } from './environment'

/**
 * What a variant component gets: the engine's props, plus what `selectCreatorPage` read from the
 * request. The variant passes all of it to CreatorPageShell as `page`.
 */
export type CreatorPageVariantProps = CreatorPageProps & {
    /** Picks the button label and the store icon in the first HTML. Presentation only. */
    deviceOs: DeviceOs
}
