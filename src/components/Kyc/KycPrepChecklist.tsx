'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import { useTranslations } from 'next-intl'

export type KycPrepPath = 'standard' | 'extended'

/**
 * The "before you start" prep content shown before the verification SDK
 * opens: what to have ready, how long it takes, and the heads-up that a
 * follow-up document can be requested. The extended path (Manteca BR/AR)
 * adds the tax ID and the regulatory questions the provider asks there.
 * Rendered inside the unlock/initiate modals, never as its own route, so
 * every entry into the SDK passes through it.
 */
const KycPrepChecklist = ({ path }: { path: KycPrepPath }) => {
    const t = useTranslations('kyc.prep')
    const items = path === 'extended' ? (['id', 'selfie', 'taxId', 'questions'] as const) : (['id', 'selfie'] as const)

    return (
        <div className="flex w-full flex-col gap-3 text-left" data-testid="kyc-prep-checklist">
            <p className="text-body-s">{t(`intro.${path}`)}</p>
            <div className="overflow-hidden rounded-sm border border-border-default dark:border-white">
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
            <div className="rounded-sm border border-border-default p-3 dark:border-white">
                <span className="block text-body-xs font-bold tracking-wide uppercase">{t('howLongLabel')}</span>
                <span className="block text-body-xs">{t(`howLong.${path}`)}</span>
            </div>
            <p className="text-body-xs text-foreground-secondary">{t('extraDocNote')}</p>
        </div>
    )
}

export default KycPrepChecklist
