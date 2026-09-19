import { EHistoryUserRole } from '@/utils/history.utils'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { isFxBearingFlow, isSendLinkEntry } from '@/components/TransactionDetails/transaction-predicates'
import {
    bankAccountLabelKey,
    receiptIssuedAt,
    type BankAccountLabelKey,
} from '@/components/TransactionDetails/transaction-details.utils'
import { maskAccountIdentifier } from '@/utils/account-mask.utils'
import { formatAmount, formatCurrency, isStableCoin, printableAddress } from '@/utils/general.utils'
import { RECEIPT_COMPANY } from '@/components/TransactionDetails/receipt-company'

/** Full-catalog translator (`t('transaction.rows.fee')`), so the PDF reuses
 *  the exact strings the receipt page renders. */
export type PdfTranslate = (key: string, values?: Record<string, string | number>) => string

export interface ReceiptPdfRow {
    label: string
    value: string
}

export interface ReceiptPdfModel {
    title: string
    issuedBy: string
    companyName: string
    companyAddressLines: readonly string[]
    site: string
    amountDisplay: string
    convertedAmountDisplay?: string
    rows: ReceiptPdfRow[]
    fileName: string
}

// IBAN / CLABE are scheme names — same in every locale (mirrors the receipt).
const BANK_ACCOUNT_SCHEME_LABELS: Partial<Record<BankAccountLabelKey, string>> = {
    iban: 'IBAN',
    clabe: 'CLABE',
}

const DATE_FALLBACK = '-'

function formatDate(source: string | Date | undefined | null, locale: string): string {
    if (!source) return DATE_FALLBACK
    const date = new Date(source)
    if (isNaN(date.getTime())) return DATE_FALLBACK
    // Same shape as useReceiptDateFormatter ("March 30, 2025 - 14:05").
    const day = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(date)
    const time = new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
    }).format(date)
    return `${day} - ${time} UTC`
}

/** Local fiat / destination-token conversion — same preference order and
 *  stablecoin skip as the receipt component's `convertedAmount`. */
function convertedAmount(transaction: TransactionDetails): string | undefined {
    const code = transaction.currency?.code
    const amount = transaction.currency?.amount
    if (code && amount) {
        const upper = code.toUpperCase()
        if (upper !== 'USD' && !isStableCoin(upper)) {
            return `${upper} ${formatCurrency(amount)}`
        }
    }
    const tokenSymbol = transaction.tokenSymbol?.toUpperCase()
    if (tokenSymbol && tokenSymbol !== 'USD' && !isStableCoin(tokenSymbol) && transaction.tokenAmount) {
        return `${transaction.tokenAmount} ${tokenSymbol}`
    }
    return undefined
}

/**
 * Everything the PDF renders, derived from the SAME view model the receipt
 * page uses (`mapTransactionDataForDrawer(...).transactionDetails`), so the
 * document can never disagree with the page. Pure — trivially unit-testable
 * and free of react-pdf imports.
 */
/**
 * Ids reach us from the backend and are not UUID-constrained (Manteca
 * synthetics are arbitrary strings), and this value lands in a quoted
 * Content-Disposition filename: a double quote would break out of the quoted
 * string and inject disposition tokens, and a CR/LF would make the Headers
 * constructor throw and turn the receipt into a 500. Keep only characters that
 * are safe unquoted, and bound the length.
 */
function safeFileNamePart(id: string): string {
    const cleaned = id.replace(/[^A-Za-z0-9._-]/g, '')
    return cleaned.slice(0, 64) || 'receipt'
}

export function buildReceiptPdfModel(
    transaction: TransactionDetails,
    t: PdfTranslate,
    locale: string
): ReceiptPdfModel {
    const rows: ReceiptPdfRow[] = []
    const push = (label: string, value: string | undefined | null) => {
        if (value) rows.push({ label, value })
    }

    const drawer = transaction.extraDataForDrawer
    const role = drawer?.originalUserRole
    const status = transaction.status
    const isCancelled = status === 'cancelled'
    // Sender-side sendlink rows keep their data after cancel (same exemption
    // as the receipt's `allowCancelledSenderFields`).
    const allowCancelledSenderFields =
        !isCancelled || (isSendLinkEntry(transaction) && role === EHistoryUserRole.SENDER)

    // One canonical issuance date is always the first field — the shared
    // status-branched rule (receiptIssuedAt), so page and pdf can never
    // disagree; never the download time.
    push(t('transaction.officialReceipt.issuedOn'), formatDate(receiptIssuedAt(transaction), locale))

    const cardType = drawer?.transactionCardType
    push(t('transaction.officialReceipt.pdf.type'), cardType ? t(`transaction.type.${cardType}`) : undefined)

    const statusLabel = status ? t(`common.status.${status}`) : undefined
    push(t('transaction.officialReceipt.pdf.status'), statusLabel)

    // Counterparty: FE-generated labels localize via nameKey; raw counterparty
    // data renders via printableAddress (shortens addresses, passes usernames).
    const counterparty = transaction.nameKey
        ? t(`transaction.${transaction.nameKey}`, transaction.nameParams)
        : transaction.userName
          ? printableAddress(transaction.userName)
          : undefined
    push(
        role === EHistoryUserRole.RECIPIENT ? t('transaction.officialReceipt.pdf.from') : t('transaction.rows.to'),
        counterparty
    )

    const exchangeRateDisplay =
        isFxBearingFlow(transaction) &&
        drawer?.receipt?.exchange_rate &&
        transaction.currency?.code &&
        transaction.currency.code.toUpperCase() !== 'USD' &&
        !isStableCoin(transaction.currency.code) &&
        !isCancelled
            ? `1 USD = ${transaction.currency.code.toUpperCase()} ${formatCurrency(drawer.receipt.exchange_rate, 4)}`
            : undefined

    if (transaction.fee !== undefined && !isCancelled) {
        push(t('transaction.rows.fee'), formatAmount(transaction.fee as number))
    }

    if (transaction.memo?.trim() && allowCancelledSenderFields) {
        push(t('common.comment'), transaction.memoKey ? t(`transaction.${transaction.memoKey}`) : transaction.memo)
    }

    // Keep the account and identifier block at the end of the document. Always
    // mask bank identifiers: PDF files are explicitly downloadable/shareable,
    // so the unmasked guest-claim exception the in-app receipt makes does not
    // apply.
    if (transaction.bankAccountDetails?.identifier && !isCancelled) {
        const labelKey = bankAccountLabelKey(transaction.bankAccountDetails.type)
        const label =
            labelKey === 'address'
                ? t('transaction.rows.address')
                : (BANK_ACCOUNT_SCHEME_LABELS[labelKey] ?? t('transaction.rows.accountNumber'))
        push(
            label,
            maskAccountIdentifier(transaction.bankAccountDetails.identifier, transaction.bankAccountDetails.type)
        )
    }

    push(t('common.exchangeRate'), exchangeRateDisplay)

    if (transaction.txHash) {
        push(t('transaction.rows.txId'), transaction.txHash)
    }

    if (
        (transaction.direction === 'bank_withdraw' || transaction.direction === 'bank_claim') &&
        transaction.id &&
        !isCancelled
    ) {
        push(t('transaction.rows.transferId'), transaction.id)
    }

    // The payer's own reference on a bank deposit is NOT printed. It is free
    // text a third party typed (up to 300 characters), and "Share receipt" sends
    // this document onward. The owner still reads it in the receipt drawer.
    // Temporary decision TD-12.

    // The history-entry id is the one identifier every receipt can use to tie
    // a renamed or printed document back to the source activity.
    push(t('transaction.officialReceipt.reference'), transaction.id)

    const numericAmount = Number(transaction.amount)
    // A request pot's `amount` is its goal, not proof of money received. The
    // receipt headline must always use the rollup's collected total, whether
    // the pot had a goal or not.
    const receiptAmount = transaction.isRequestPotLink ? Number(transaction.totalAmountCollected) : numericAmount
    const safeAmount = Number.isFinite(receiptAmount) ? Math.abs(receiptAmount) : 0

    return {
        title: t('transaction.officialReceipt.pdf.title'),
        issuedBy: t('transaction.officialReceipt.pdf.issuedBy'),
        companyName: RECEIPT_COMPANY.name,
        companyAddressLines: RECEIPT_COMPANY.addressLines,
        site: RECEIPT_COMPANY.site,
        amountDisplay: `$${formatCurrency(safeAmount.toString())}`,
        convertedAmountDisplay: convertedAmount(transaction),
        rows,
        fileName: `peanut-receipt-${safeFileNamePart(transaction.id)}.pdf`,
    }
}
