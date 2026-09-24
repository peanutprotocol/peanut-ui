'use client'

import { PageStack } from '@/components/0_Bruddle/PageStack'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import ShareButton from '@/components/Global/ShareButton'
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
            referenceLine: t('share.referenceRequired'),
            eurOwnNameLine: t('share.eurOwnName'),
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
            {/* The shared copy control: it confirms on itself, and a failed
                copy is the one toast. */}
            <CopyToClipboard
                type="button"
                textToCopy={text}
                className="w-full"
                label={t('share.copyCta')}
                onCopy={() => trackShared(rail.corridor, 'copy')}
            />
        </PageStack.Footer>
    )
}
