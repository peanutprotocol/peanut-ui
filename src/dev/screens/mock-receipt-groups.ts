/**
 * Receipt-groups mockup captures (branch mock/receipt-groups, Oct 2026).
 *
 * Two catalogue entries per screen, `mock-rows-<layout>-<screen>`: `current`
 * is the screen as it ships, `grouped` the pitch (every row a DataRow, rows
 * grouped by theme, one dashed divider between groups). Every route carries
 * `?rows=<layout>` (src/features/receipt-groups/row-layout.ts), so one build
 * serves both. Routes, fixtures and taps are the catalogue's own
 * (p64-withdraw-europe and the not-us-UX set). The GBP review uses a fixture
 * that holds the UK sort-code account alone: the UK fixture's two accounts end
 * in the same digits and the pipeline taps by text.
 */
import { ROW_LAYOUT_PARAM, type RowLayout } from '@/features/receipt-groups/row-layout'
import type { PageCapture } from './pages'

const withRows = (route: string, layout: RowLayout): string => {
    const url = new URL(route, 'http://capture.local')
    url.searchParams.set(ROW_LAYOUT_PARAM, layout)
    return `${url.pathname}${url.search}`
}

type Actions = NonNullable<PageCapture['actions']>
const REVIEW_ACTIONS = (account: string): Actions => [
    { click: account },
    { fill: { selector: 'input[inputmode=decimal]', value: '50' } },
    { click: 'Continue' },
]
// The pipeline scrolls right after the URL matches, before a quote-gated
// review has rendered, so a shot below the fold first taps a harmless line
// that exists only once the screen is complete (the helper line under the
// reference field; the already selected ACH option, which changes nothing,
// waits for the USD review's rail fees as well).
const REACH_FOOTER: Actions = [{ click: 'bank shows it with the payment' }]
const REACH_FOOTER_USD: Actions = [{ click: 'ACH (free)' }, ...REACH_FOOTER]

const LAYOUTS: RowLayout[] = ['current', 'grouped']
const label = (layout: RowLayout) => (layout === 'grouped' ? 'grouped rows (pitch)' : 'as today')

export const MOCK_PAGE_CAPTURES: PageCapture[] = LAYOUTS.flatMap((layout) => [
    {
        id: `mock-rows-${layout}-withdraw-review-eur`,
        name: `Mock rows: EUR SEPA review, ${label(layout)}`,
        route: '/withdraw/spain/bank',
        entryRoute: withRows('/withdraw?amount=50', layout),
        fixture: 'withdraw',
        // the review card, fine print and CTA sit under the tab bar at 852: scroll to them
        toBottom: true,
        actions: [...REVIEW_ACTIONS('0802'), ...REACH_FOOTER],
    },
    {
        id: `mock-rows-${layout}-withdraw-review-usd`,
        name: `Mock rows: USD ACH review, ${label(layout)}`,
        route: '/withdraw/usa/bank',
        entryRoute: withRows('/withdraw?amount=50', layout),
        fixture: 'withdraw-usd-speed',
        toBottom: true,
        actions: [...REVIEW_ACTIONS('8030'), ...REACH_FOOTER_USD],
    },
    {
        id: `mock-rows-${layout}-withdraw-review-gbp`,
        name: `Mock rows: GBP Faster Payments review, ${label(layout)}`,
        route: '/withdraw/united-kingdom/bank',
        entryRoute: withRows('/withdraw?amount=50', layout),
        fixture: 'mock-withdraw-gbp',
        toBottom: true,
        actions: [...REVIEW_ACTIONS('55555555'), ...REACH_FOOTER],
    },
    {
        id: `mock-rows-${layout}-receipt-wire-withdrawal`,
        name: `Mock rows: wire withdrawal receipt, ${label(layout)}`,
        route: withRows('/history', layout),
        fixture: 'history-wire-withdrawal',
        clicks: ['Bank account'],
    },
])
