'use client'

import CopyToClipboard from '@/components/Global/CopyToClipboard'
import ShareButton from '@/components/Global/ShareButton'
import { useAuth } from '@/context/authContext'
import type { RequestDepositInstructions } from '@/services/services.types'
import { formatBankAmount } from '@/utils/currency'
import { useTranslations } from 'next-intl'
import { ceilToMinorUnit, readServerPayerAmount } from '../payerAmount'
import { buildShareText } from '../shareText'
import { useDepositAccountCopy } from '../useDepositAccountCopy'

/** The share pair from the account screen, with the request's amount and reference added to the text. */
export function RequestShareActions({
    instructions,
    currency,
}: {
    instructions: RequestDepositInstructions
    currency: string
}) {
    const t = useTranslations('payment')
    const { t: tDeposit, rowLabels, railLabels, senderLimit } = useDepositAccountCopy()
    const { user } = useAuth()
    const userName = user?.user.fullName || user?.user.username || ''
    const account = instructions.depositAccount

    // Only an exact figure travels: a payer who sends an estimate may not settle the request.
    const server = readServerPayerAmount(instructions.payerAmount)
    const amountRow =
        server && server.value !== null && server.value > 0 && !server.isEstimate && server.currency === currency
            ? `${t('bankTransfer.amountLabel')}: ${formatBankAmount(ceilToMinorUnit(server.value, currency), currency)}`
            : undefined

    const ownName = account.matching.nameOnAccount === 'user'
    const text = buildShareText(
        account,
        {
            introOwn: tDeposit('share.textIntroOwn', { currency }),
            introPooled: tDeposit('share.textIntroPooled', { user: userName, currency }),
            outro: tDeposit('share.textOutro'),
            payerLine: senderLimit(account.matching)?.payer,
            referenceLine: tDeposit('share.referenceRequired'),
            eurOwnNameLine: tDeposit('share.eurOwnName'),
            request: {
                amountRow,
                referenceRow: `${t('bankTransfer.referenceLabel')}: ${instructions.paymentReference}`,
            },
        },
        rowLabels,
        railLabels
    )

    return (
        <div className="flex flex-col gap-3">
            <ShareButton
                generateText={async () => text}
                title={
                    ownName ? tDeposit('share.sheetTitleOwn') : tDeposit('share.sheetTitlePooled', { user: userName })
                }
                className="w-full"
            >
                {tDeposit('details.shareCta')}
            </ShareButton>
            <CopyToClipboard type="button" textToCopy={text} className="w-full" label={tDeposit('share.copyCta')} />
        </div>
    )
}
