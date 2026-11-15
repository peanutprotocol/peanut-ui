'use client'

import { Callout } from '@/components/0_Bruddle/Callout'
import Card from '@/components/Global/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { useTranslations } from 'next-intl'

const ITEMS = ['id', 'selfie', 'proofOfAddress'] as const

/**
 * What to have ready before Bridge's hosted flow (Persona), which runs outside
 * the app and — unlike the Sumsub SDK — keeps no partial progress: a user who
 * leaves to find a document restarts from the first step. The single-session
 * warning sits AFTER the list so it reads as the consequence of not having
 * those documents rather than as a preamble to them.
 *
 * The Sumsub starts show /verify's steps instead (IdentityCheckIntroScreen).
 */
const KycPrepChecklist = () => {
    const t = useTranslations('kyc.prep')

    return (
        <div className="flex w-full flex-col gap-3 text-left" data-testid="kyc-prep-checklist">
            {/* The requirements are label + value pairs, not claims, so they read
                as DataRows in a card rather than a tinted checklist. The label is
                the short document name so the value has room, and what counts as
                that document stays on screen under its row — it is the part a
                user gets wrong, so it does not belong behind a tooltip. */}
            <Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
                {ITEMS.map((item) => (
                    <div key={item} className="pb-3">
                        <DataRow label={t(`items.${item}.label`)} value={t(`items.${item}.title`)} />
                        <p className="text-body-xs text-foreground-secondary">{t(`items.${item}.body`)}</p>
                    </div>
                ))}
            </Card>
            <Callout priority="attention" title={t('singleSession.title')} data-testid="kyc-prep-single-session">
                {/* The banner's own body step is text-body-m, which reads
                    louder than the requirement titles right above it. */}
                <span className="flex flex-col gap-2 text-body-s">
                    <span>{t('singleSession.body')}</span>
                    <span>{t('howLong.hosted')}</span>
                </span>
            </Callout>
        </div>
    )
}

export default KycPrepChecklist
