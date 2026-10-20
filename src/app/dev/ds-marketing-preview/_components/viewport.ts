// The two proof widths for the /dev/ds/marketing demos. Phone and desktop are
// what the rules pin; tablet is explicitly ignored — between the two widths the
// bands just interpolate.
export type PreviewViewport = 'phone' | 'desktop'

export const VIEWPORT_WIDTHS: Record<PreviewViewport, number> = {
    phone: 390,
    desktop: 1440,
}

/** the route group that serves the bare demo pages the frames load */
export const PREVIEW_BASE_PATH = '/dev/ds-marketing-preview'
