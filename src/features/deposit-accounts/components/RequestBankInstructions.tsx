'use client'

import { DataRow } from '@/components/0_Bruddle/DataRow'
import Card from '@/components/Global/Card'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Section } from '@/components/0_Bruddle/Section'
import type { RequestDepositInstructions } from '@/services/services.types'
import { useTranslations } from 'next-intl'
import { instructionRows } from '../instructionRows'
import { corridorFromRailId } from '../rails'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { DepositDetailsCard } from './DepositDetailsCard'

/**
 * The requester's bank details, shown to the payer of one request.
 *
 * The details card is the SAME one the account holder reads on their own
 * details screen, built from the same `instructionRows`. A payer and a holder
 * looking at one account must never see two different sets of numbers.
 *
 * The reference is the only thing this screen adds, and it is the one field
 * the payment depends on: without it the deposit still credits the requester,
 * but nothing connects it to this request and the request stays open.
 */
export function RequestBankInstructions({ instructions }: { instructions: RequestDepositInstructions }) {
    const t = useTranslations('payment')
    const { t: tDeposit, rowLabels, railLabels, arrivalDetail } = useDepositAccountCopy()
    const account = instructions.depositAccount

    const rows = account.instructions ? instructionRows(account.instructions, rowLabels, railLabels) : []
    const corridor = corridorFromRailId(account.railId)

    return (
        <div className="flex flex-col gap-4">
            <Section title={tDeposit('details.sectionTitle')}>
                <DepositDetailsCard rows={rows} />
            </Section>

            <Section title={t('bankTransfer.referenceSection')}>
                <Card position="single" className="px-4 py-0">
                    <DataRow
                        label={t('bankTransfer.referenceLabel')}
                        value={instructions.paymentReference}
                        allowCopy={true}
                    />
                </Card>
                <Notification priority="attention">{t('bankTransfer.referenceNote')}</Notification>
            </Section>

            {corridor && <p className="text-body-s text-foreground-secondary">{arrivalDetail(corridor)}</p>}
        </div>
    )
}
