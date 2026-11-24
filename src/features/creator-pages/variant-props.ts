import type { DeviceOs } from './environment'
import type { CreatorPageProps } from './types'

/**
 * What a variant component gets: the route's props, plus what `selectCreatorPage` read from the
 * request. The variant passes all of it to CreatorPageShell as `page`.
 */
export type CreatorPageVariantProps = CreatorPageProps & {
    /** Picks the button label and the store icon in the first HTML. Presentation only. */
    deviceOs: DeviceOs
    /** The in-app browser covers the bottom of the page (`coversPageBottom`): the page lifts its bottom button. */
    liftCta: boolean
}
