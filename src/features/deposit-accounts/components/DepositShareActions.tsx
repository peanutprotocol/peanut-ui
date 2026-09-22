'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useToast } from '@/components/0_Bruddle/Toast'
import ShareButton from '@/components/Global/ShareButton'
import { copyTextToClipboard } from '@/utils/clipboard.utils'
import { trackShared } from '../analytics'
import { buildShareText } from '../shareText'
import type { DepositAccountView, DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'

export function DepositShareActions({
    rail,
    account,
    userName,
}: {
    rail: DepositRail
    account: DepositAccountView
    userName: string
}) {
    const toast = useToast()
    const { t, rowLabels, railLabels } = useDepositAccountCopy()

    if (!account.instructions) return null

    const ownName = account.matching.nameOnAccount === 'user'
    const text = buildShareText(
        account,
        {
            introOwn: t('share.textIntroOwn', { currency: rail.currency }),
            introPooled: t('share.textIntroPooled', { user: userName, currency: rail.currency }),
            outro: t('share.textOutro'),
            payerLine: { 'business-only': t('share.payerBusinessOnly'), unknown: t('share.payerUnconfirmed') },
        },
        rowLabels,
        railLabels
    )

    return (
        <PageStack.Footer>
            <ShareButton
                generateText={async () => {
                    trackShared(rail.corridor, 'share-sheet')
                    return text
                }}
                title={ownName ? t('share.sheetTitleOwn') : t('share.sheetTitlePooled', { user: userName })}
                className="w-full"
            >
                {t('details.shareCta')}
            </ShareButton>
            <Button
                variant="secondary"
                className="w-full"
                icon="copy"
                onClick={async () => {
                    const copied = await copyTextToClipboard(text)
                    if (copied) trackShared(rail.corridor, 'copy')
                    if (copied) toast.success(t('share.copied'))
                    else toast.error(t('share.copyFailed'))
                }}
            >
                {t('share.copyCta')}
            </Button>
        </PageStack.Footer>
    )
}
