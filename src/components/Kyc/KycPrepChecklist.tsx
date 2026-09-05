'use client'

import { Notification } from '@/components/0_Bruddle/Notification'
import Card from '@/components/Global/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { useTranslations } from 'next-intl'

export type KycPrepPath = 'standard' | 'extended' | 'hosted'

/**
 * The "before you start" prep content shown before the verification SDK
 * opens: what to have ready, how long it takes, and the heads-up that a
 * follow-up document can be requested. The extended path (Manteca BR/AR)
 * adds the tax ID and the regulatory questions the provider asks there.
 * Rendered inside the unlock/initiate modals, never as its own route, so
 * every entry into the SDK passes through it.
 *
 * The hosted path is Bridge's hosted flow (Persona), which runs outside the
 * app and — unlike the Sumsub SDK — keeps no partial progress: a user who
 * leaves to find a document restarts from the first step. It trades the
 * "we'll ask later if we need more" note for a single-session warning, placed
 * AFTER the list so it reads as the consequence of not having those documents
 * rather than as a preamble to them.
 */
const KycPrepChecklist = ({ path }: { path: KycPrepPath }) => {
    const t = useTranslations('kyc.prep')
    const isHosted = path === 'hosted'
    const items =
        path === 'extended'
            ? (['id', 'selfie', 'taxId', 'questions'] as const)
            : isHosted
              ? (['id', 'selfie', 'proofOfAddress'] as const)
              : (['id', 'selfie'] as const)

    return (
        <div className="flex w-full flex-col gap-3 text-left" data-testid="kyc-prep-checklist">
            {!isHosted && <p className="text-body-s">{t(`intro.${path}`)}</p>}
            {/* The requirements are label + value pairs, not claims, so they read
                as DataRows in a card rather than a tinted checklist. The label is
                the short document name so the value has room; what counts as that
                document hangs off the row's own info tooltip. */}
            <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
                {items.map((item) => (
                    <DataRow
                        key={item}
                        label={t(`items.${item}.label`)}
                        value={t(`items.${item}.title`)}
                        moreInfoText={t(`items.${item}.body`)}
                    />
                ))}
            </Card>
            {isHosted && (
                <Notification
                    priority="attention"
                    title={t('singleSession.title')}
                    data-testid="kyc-prep-single-session"
                >
                    {/* The banner's own body step is text-body-m, which reads
                        louder than the requirement titles right above it. */}
                    <span className="text-body-s">{t('singleSession.body')}</span>
                </Notification>
            )}
            {/* Above "how long": the note is about WHAT may still be asked for,
                so it belongs with the requirements list it qualifies. Duration
                reads last, as the closing fact. */}
            {!isHosted && <p className="text-body-xs text-foreground-secondary">{t('extraDocNote')}</p>}
            {/* Plain prose, not a card: the framed box read as one more
                requirement alongside the list above it, when it is only a note. */}
            <div className="flex flex-col gap-0.5">
                <span className="text-label-m tracking-wide uppercase">{t('howLongLabel')}</span>
                <span className="text-body-xs text-foreground-secondary">{t(`howLong.${path}`)}</span>
            </div>
        </div>
    )
}

export default KycPrepChecklist
