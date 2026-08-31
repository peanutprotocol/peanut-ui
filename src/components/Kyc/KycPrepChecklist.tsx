'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import { Notification } from '@/components/0_Bruddle/Notification'
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
            <div className="overflow-hidden rounded-sm border border-border-default bg-background-default dark:border-white dark:bg-foreground-primary">
                {items.map((item) => (
                    <div
                        key={item}
                        className="flex items-start gap-2 border-t border-border-default p-3 first:border-t-0 dark:border-white"
                    >
                        <Icon name="check-circle" className="mt-0.5 size-4 shrink-0" />
                        <span>
                            <span className="block text-body-s font-bold">{t(`items.${item}.title`)}</span>
                            <span className="block text-body-xs text-foreground-secondary">
                                {t(`items.${item}.body`)}
                            </span>
                        </span>
                    </div>
                ))}
            </div>
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
            {/* Plain prose, not a card: the framed box read as one more
                requirement alongside the list above it, when it is only a note. */}
            <div className="flex flex-col gap-0.5">
                <span className="text-body-xs font-bold tracking-wide uppercase">{t('howLongLabel')}</span>
                <span className="text-body-xs text-foreground-secondary">{t(`howLong.${path}`)}</span>
            </div>
            {!isHosted && <p className="text-body-xs text-foreground-secondary">{t('extraDocNote')}</p>}
        </div>
    )
}

export default KycPrepChecklist
