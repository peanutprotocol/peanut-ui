/**
 * The dev-only `?rows=` switch of the receipt-groups mockups (branch
 * mock/receipt-groups). `current` renders every review and receipt card as it
 * ships; `grouped` renders the pitch: every row a `DataRow`, rows grouped by
 * theme, one dashed divider between groups. Kept free of React so the capture
 * catalogue can import the parameter name.
 */
export const ROW_LAYOUT_PARAM = 'rows'

export type RowLayout = 'current' | 'grouped'

export function parseRowLayout(raw: string | null): RowLayout {
    return raw === 'grouped' ? 'grouped' : 'current'
}
