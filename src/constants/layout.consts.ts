/** Reading-column widths shared by marketing pages and the few Global
 *  components they render (FAQsPanel). They live outside components/Marketing
 *  because Global/FAQs sits in the captured app tree, and the screen library
 *  proves no captured screen imports a marketing module
 *  (scripts/screens/capture-marketing.test.mjs). Marketing/constants re-exports
 *  them, so marketing code keeps one import. */

/** Prose content column width class. Matches Wise's ~600px content width for readability. */
export const PROSE_WIDTH = 'max-w-[640px]'

/** Content-hub column. Wider than the prose column because the hub lists rows,
 *  not sentences. Two constants, two roles — they are not interchangeable. */
export const HUB_WIDTH = 'max-w-[720px]'

/** design.md § layout: one section band step, 24px phone gutter and 64/96
 *  vertical padding. Shared by the marketing FAQ fold and the star-LP bands. */
export const MARKETING_BAND_PADDING = 'px-6 py-16 md:px-4 md:py-24'
