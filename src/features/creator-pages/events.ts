import type { DeviceOs, InAppBrowser } from './environment'
import type { CreatorPageProps } from './types'

// Read-out: mono engineering/ui/creator-pages.md
export const CREATOR_PAGE_EVENTS = {
    VIEWED: 'creator_page_viewed',
    CTA_CLICKED: 'creator_page_cta_clicked',
} as const

export type CreatorPageEnvironment = { deviceOs: DeviceOs; inAppBrowser: InAppBrowser }

export type CtaPosition = 'hero' | 'sticky' | 'footer'

/** The properties both events share. The tap adds `cta_position`. */
export function creatorPageEventProperties(page: CreatorPageProps, environment: CreatorPageEnvironment) {
    return {
        creator_username: page.username,
        experiment_id: page.experimentId,
        variant: page.variant,
        device_os: environment.deviceOs,
        in_app_browser: environment.inAppBrowser,
    }
}
