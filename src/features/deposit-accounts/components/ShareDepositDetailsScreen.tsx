'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { useToast } from '@/components/0_Bruddle/Toast'
import NavHeader from '@/components/Global/NavHeader'
import ShareButton from '@/components/Global/ShareButton'
import { copyTextToClipboard } from '@/utils/clipboard.utils'
import { trackShared } from '../analytics'
import { instructionRows } from '../instructionRows'
import { buildShareText } from '../shareText'
import type { DepositAccount, DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { DepositDetailsCard } from './DepositDetailsCard'

/**
 * Screen 3 — what the payer sees.
 *
 * The reader is an employer, a client or a payroll form, so the copy
 * addresses them and the possessive follows the account rather than the
 * speaker: a pooled account is never "my account" in a string that leaves
 * the app.
 */
export function ShareDepositDetailsScreen({
    rail,
    account,
    userName,
    onBack,
}: {
    rail: DepositRail
    account: DepositAccount
    userName: string
    onBack: () => void
}) {
    const toast = useToast()
    const { t, rowLabels, railLabels, senderNotes } = useDepositAccountCopy()

    if (!account.instructions) return null

    const ownName = account.matching.nameOnAccount === 'user'
    const holder = account.instructions.accountHolderName
    const rows = instructionRows(account.instructions, rowLabels, railLabels)
    const senderNote = senderNotes[account.matching.sender]
    const text = buildShareText(
        account,
        {
            introOwn: t('share.textIntroOwn', { currency: rail.currency }),
            introPooled: t('share.textIntroPooled', { user: userName, currency: rail.currency }),
            reference: account.instructions.memo
                ? t('share.textReference', { memo: account.instructions.memo })
                : undefined,
            senderNotes,
            outro: t('share.textOutro'),
        },
        rowLabels,
        railLabels
    )

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="flex flex-col gap-6">
                <TitleBlock size="s" title={t('share.heading')} description={t('share.subheading')} />

                <Section title={t('share.sectionTitle', { user: userName, currency: rail.currency })}>
                    <DepositDetailsCard rows={rows} />
                </Section>

                {/*
                 * The same sentence the copied text carries, said on screen.
                 * The user is about to hand these details to somebody, and who
                 * may pay in decides whether that payment arrives or comes
                 * back weeks later.
                 */}
                {senderNote && (
                    <Notification priority="attention" title={t('share.senderWarningTitle')}>
                        {senderNote}
                    </Notification>
                )}

                {!ownName && (
                    <Notification priority="attention" title={t('share.nameWarningTitle')}>
                        {t('share.nameWarningBody', { holder, user: userName })}
                    </Notification>
                )}
            </div>
            <PageStack.Footer>
                <ShareButton
                    generateText={async () => {
                        trackShared(rail.corridor, 'share-sheet')
                        return text
                    }}
                    title={ownName ? t('share.sheetTitleOwn') : t('share.sheetTitlePooled', { user: userName })}
                    className="w-full"
                >
                    {t('share.shareCta')}
                </ShareButton>
                <Button
                    variant="stroke"
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
        </PageStack>
    )
}
