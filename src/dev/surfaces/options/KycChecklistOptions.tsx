'use client'

/**
 * The KycPrepChecklist rework, as real renders — the block InitiateKycModal and
 * UnlockMethodModal both host. Harness-only.
 */

import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import Card from '@/components/Global/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'

const ITEMS = ['id', 'selfie'] as const

/**
 * The checklist never renders on its own — InitiateKycModal hosts it as the
 * modal's description. Both options are shown in that shell so the comparison
 * is of the real screen, not of a fragment on a blank page.
 */
function Shell({ children }: { children: React.ReactNode }) {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    return (
        <ActionModal
            visible
            onClose={() => {}}
            icon="badge"
            title={t('initiate.titleDefault')}
            description={
                <div className="flex flex-col gap-3 text-left">
                    <p>{t('initiate.descriptionDefault')}</p>
                    {children}
                </div>
            }
            ctas={[{ text: tCommon('continue'), shadowSize: '4', onClick: () => {} }]}
            footer={<PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />}
        />
    )
}

/** A — minimal bullets, the version the review recorded as final. */
export function KycChecklistA() {
    const t = useTranslations('kyc.prep')
    return (
        <Shell>
            <div className="flex w-full flex-col gap-3 text-left">
                <p className="text-body-s">{t('intro.standard')}</p>
                <ul className="flex flex-col gap-3">
                    {ITEMS.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground-primary" />
                            <span>
                                <span className="block text-label-l">{t(`items.${item}.title`)}</span>
                                <span className="block text-body-xs text-foreground-secondary">
                                    {t(`items.${item}.body`)}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>
                <p className="text-body-xs text-foreground-secondary">{t('extraDocNote')}</p>
                <div className="flex flex-col gap-0.5">
                    <span className="text-label-m tracking-wide uppercase">{t('howLongLabel')}</span>
                    <span className="text-body-xs text-foreground-secondary">{t('howLong.standard')}</span>
                </div>
            </div>
        </Shell>
    )
}

/** B — DataRow, the version you remember. */
export function KycChecklistB() {
    const t = useTranslations('kyc.prep')
    return (
        <Shell>
            <div className="flex w-full flex-col gap-3 text-left">
                <p className="text-body-s">{t('intro.standard')}</p>
                <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
                    {ITEMS.map((item) => (
                        <DataRow key={item} label={t(`items.${item}.title`)} value={t(`items.${item}.body`)} />
                    ))}
                </Card>
                <p className="text-body-xs text-foreground-secondary">{t('extraDocNote')}</p>
                <div className="flex flex-col gap-0.5">
                    <span className="text-label-m tracking-wide uppercase">{t('howLongLabel')}</span>
                    <span className="text-body-xs text-foreground-secondary">{t('howLong.standard')}</span>
                </div>
            </div>
        </Shell>
    )
}
