/**
 * The details card underlines every row with a dashed rule and drops it on the
 * last one, so the rule doesn't double up with the card's own black border.
 *
 * `shouldHideBorder` can only reach rows the receipt renders itself. These cases
 * end on a row the receipt delegates to a sub-component that renders its own
 * rows — which is why the row container also carries
 * `[&>*:last-child]:border-b-0`. If a future change makes the delegating rows
 * unreachable as "last", this test is the thing that says so.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { renderHook } from '@testing-library/react'
import { mapTransactionDataForDrawer } from '../transactionTransformer'
import { useReceiptViewModel } from '../useReceiptViewModel'
import { transactionDetailsRowKeys } from '../transaction-details.utils'
import type { HistoryEntry } from '@/utils/history.utils'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

// Rows the receipt hands to a sub-component (MantecaDepositInfo,
// BridgeDepositInstructions) that expands into rows of its own. Those rows never
// see `hideBottomBorder`, so the container rule is what clears the last one.
// `cardPayment` is absent on purpose: CardPaymentRows takes an `isLastRow` prop.
const DELEGATED_ROWS = ['mantecaDepositInfo', 'depositInstructions']

type Case = { name: string; entry: HistoryEntry }

const cases = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'render-baseline.json'), 'utf8')) as Case[]

const lastVisibleRow = (entry: HistoryEntry): string | undefined => {
    const { transactionDetails } = mapTransactionDataForDrawer(entry)
    const { result } = renderHook(() => useReceiptViewModel(transactionDetails, { isPublic: false }))
    const visible = transactionDetailsRowKeys.filter((key) => result.current.rowVisibilityConfig[key])
    return visible[visible.length - 1]
}

describe('receipt details card — trailing dashed rule', () => {
    const byName = (name: string) => {
        const found = cases.find((c) => c.name === name)
        if (!found) throw new Error(`fixture ${name} missing from render-baseline.json`)
        return found.entry
    }

    it('the bridge pending deposit ends on a delegated row', () => {
        expect(lastVisibleRow(byName('onramp-bridge-awaiting_funds-recipient'))).toBe('depositInstructions')
    })

    it('no other fixture ends on a delegated row', () => {
        const delegated = cases
            .map((c) => ({ name: c.name, last: lastVisibleRow(c.entry) }))
            .filter(({ last }) => !!last && DELEGATED_ROWS.includes(last))
            .map(({ name }) => name)

        expect(delegated).toEqual(['onramp-bridge-awaiting_funds-recipient'])
    })

    // The second way the flag misses: a row the config calls visible carries an
    // extra runtime gate in the JSX and doesn't reach the DOM, so the row above it
    // keeps its rule and ends up last. These two are the live examples.
    it('records the rows that can be config-visible but absent from the DOM', () => {
        const doubleGated = ['tokenAndNetwork', 'exchangeRate']
        const atRisk = cases.map((c) => lastVisibleRow(c.entry)).filter((last) => !!last && doubleGated.includes(last))

        expect(atRisk.length).toBeGreaterThan(0)
    })
})
