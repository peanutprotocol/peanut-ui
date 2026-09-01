'use client'

import NavHeader from '@/components/Global/NavHeader'
import ShareButton from '@/components/Global/ShareButton'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { copyTextToClipboardWithFallback } from '@/utils/general.utils'
import { DepositDetailsCard } from './DepositDetailsCard'
import { USER_NAME, mockDepositAccount } from './mock'
import { instructionRows } from './rows.utils'
import { buildShareText } from './share.utils'
import type { VaRail } from './types'

/**
 * Screen 3 — what the payer sees. Third-party inbound is the point: the
 * person reading this is an employer, a client or a payroll form, not the
 * user. Same receipt card, payer order, reference as the last row; the
 * share text is the shipped generateBankDetails shape.
 */
export function ShareScreen({ rail, sku, onBack }: { rail: VaRail; sku: boolean; onBack: () => void }) {
    const toast = useToast()
    const tGlobal = useTranslations('global')
    const account = mockDepositAccount(rail, sku)
    const memo = account.matching.memo === 'required' ? account.instructions.memo : null
    const rows = instructionRows(account.instructions, rail)
    const text = buildShareText(rail, rows, memo)

    return (
        <PageStack>
            <NavHeader title="Get paid" onPrev={onBack} />
            <div className="flex flex-col gap-6">
                <TitleBlock
                    size="s"
                    title="What the payer sees"
                    description="Send this to the employer, client or platform that pays you. It is the same for every payment."
                />
                <Section title={`Pay ${USER_NAME} in ${rail.code}`}>
                    <DepositDetailsCard rows={rows} memo={memo} />
                </Section>
                {memo && (
                    <Notification priority="attention" title="The reference is not optional">
                        Payroll and platform forms have a separate reference or memo field. The payer puts {memo} there,
                        or the money comes back.
                    </Notification>
                )}
            </div>
            <PageStack.Footer>
                <ShareButton generateText={async () => text} title="My bank details" className="w-full">
                    Share
                </ShareButton>
                <Button
                    variant="stroke"
                    className="w-full"
                    icon="copy"
                    onClick={async () => {
                        await copyTextToClipboardWithFallback(text)
                        toast.info(tGlobal('shareButton.textCopied'))
                    }}
                >
                    Copy as text
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}
