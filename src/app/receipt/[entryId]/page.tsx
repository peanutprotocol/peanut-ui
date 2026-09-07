import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { captureException } from '@sentry/nextjs'
import { isFinalState, type HistoryEntry } from '@/utils/history.utils'
import { getHistoryEntry } from '@/app/actions/history'
import {
    mapTransactionDataForDrawer,
    type TransactionDetails,
} from '@/components/TransactionDetails/transactionTransformer'
import { resolveReceiptKind } from '@/components/TransactionDetails/strategies/registry'
import { TransactionDetailsReceipt } from '@/components/TransactionDetails/TransactionDetailsReceipt'
import { ReceiptUnavailable } from '@/components/TransactionDetails/ReceiptUnavailable'
import NavHeader from '@/components/Global/NavHeader'
import { generateMetadata as generateBaseMetadata } from '@/app/metadata'
import { type Metadata } from 'next'
import { BASE_URL } from '@/constants/general.consts'
import { formatCurrency } from '@/utils/general.utils'
import { buildOgImageUrl } from '@/utils/og.utils'
import getOrigin from '@/lib/hosting/get-origin'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { generateReceiptTitle, generateReceiptDescription } from './receipt-metadata.utils'

// Helper function to map transaction card type to OG image type
function mapTransactionTypeToOGType(transactionType: string): 'send' | 'request' {
    switch (transactionType) {
        case 'request':
            return 'request'
        case 'send':
        case 'receive':
        case 'withdraw':
        case 'bank_withdraw':
        case 'bank_deposit':
        case 'bank_claim':
        case 'claim_external':
        case 'add':
        case 'pay':
        default:
            return 'send'
    }
}

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ entryId: string }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
    const basicMetadata = generateBaseMetadata({
        title: `Receipt`,
        description: `View the receipt for the transaction`,
    })

    const { entryId } = await params
    const resolvedParams = await searchParams
    const kind = resolveReceiptKind(resolvedParams.kind, resolvedParams.t)
    if (!entryId || !kind) {
        return basicMetadata
    }

    let transactionDetails: TransactionDetails
    try {
        const entry = await getHistoryEntry(entryId, kind)
        if (!entry) {
            return basicMetadata
        }
        // Transform the entry data to get readable transaction details
        transactionDetails = mapTransactionDataForDrawer(entry).transactionDetails
    } catch {
        // the page body reports the failure; metadata just degrades
        return basicMetadata
    }

    // Generate dynamic title and description
    const title = generateReceiptTitle(transactionDetails)
    const description = generateReceiptDescription(transactionDetails.status || 'pending')

    // Generate dynamic OG image URL
    const origin = (await getOrigin()) || BASE_URL
    const ogType = mapTransactionTypeToOGType(transactionDetails.extraDataForDrawer?.transactionCardType || 'send')
    const hasAmount = transactionDetails.amount > 0
    // include username only when present and not an address-like string
    const hasUsername = Boolean(
        transactionDetails.userName &&
        transactionDetails.userName.length < 20 &&
        !transactionDetails.userName.startsWith('0x')
    )

    const ogImageUrl = buildOgImageUrl(
        {
            type: ogType,
            isReceipt: true,
            username: hasUsername ? transactionDetails.userName : undefined,
            // always denominate the receipt amount in USD
            amount: hasAmount ? formatCurrency(Number(transactionDetails.amount).toString()) : undefined,
            token: hasAmount ? 'USDC' : undefined,
        },
        origin
    )

    return generateBaseMetadata({
        title,
        description,
        image: ogImageUrl,
        keywords: 'crypto receipt, transaction receipt, payment receipt, Peanut Protocol',
    })
}

export default async function ReceiptPage({
    params,
    searchParams,
}: {
    params: Promise<{ entryId: string }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const { entryId } = await params
    const resolvedParams = await searchParams
    const kind = resolveReceiptKind(resolvedParams.kind, resolvedParams.t)
    // No resolvable kind — most often a pre-May-2026 `?t=` link whose id no
    // longer resolves. A hard 404 reads as breakage on a link users hold, so
    // show a branded explanation instead.
    if (!entryId || !kind) {
        return <ReceiptShell state="gone" />
    }
    let entry: HistoryEntry | null
    try {
        entry = await getHistoryEntry(entryId, kind)
    } catch (error) {
        // A BE hiccup was crashing the whole Server Components render
        // (PEANUT-UI-4S9); keep the Sentry signal but render a retryable state.
        captureException(error)
        return <ReceiptShell state="loadFailed" />
    }
    if (!entry) {
        notFound()
    }
    if (!isFinalState(entry)) {
        await connection()
    }
    let transactionDetails: TransactionDetails | undefined
    try {
        transactionDetails = mapTransactionDataForDrawer(entry).transactionDetails
    } catch (error) {
        captureException(error)
    }
    if (!transactionDetails) {
        return <ReceiptShell state="loadFailed" />
    }
    return (
        <ReceiptShell>
            <TransactionDetailsReceipt className="w-full" transaction={transactionDetails} isPublic />
        </ReceiptShell>
    )
}

function ReceiptShell({ state, children }: { state?: 'gone' | 'loadFailed'; children?: React.ReactNode }) {
    return (
        <PageContainer className="receipt-page flex min-h-dvh flex-col items-center justify-center p-6">
            <div className="md:hidden print:hidden">
                <NavHeader titleKey="receipt" />
            </div>
            <div className="flex flex-1 flex-col items-center justify-center">
                {state ? <ReceiptUnavailable variant={state} /> : children}
            </div>
        </PageContainer>
    )
}
