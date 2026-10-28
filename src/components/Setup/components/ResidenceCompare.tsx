'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Divider } from '@/components/0_Bruddle/Divider'
import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { type ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { residenceAvailability } from '@/utils/residence-availability'
import SetupFooter from './SetupFooter'

/**
 * Residence and citizenship differ: which of the two Peanut is set up for,
 * with what each unlocks. One tap picks the country and continues.
 */
export function ResidenceCompare({
    residence,
    citizenship,
    labelOf,
    restrictionSets,
    restrictionsSettled,
    busy,
    onChoose,
}: {
    residence: string
    citizenship: string
    labelOf: (country: string) => string
    restrictionSets: ResidenceRestrictionSets
    /** false while the server's tier lists load: the bundled mirror is not enough to name an offer */
    restrictionsSettled: boolean
    busy: boolean
    onChoose: (country: string) => void
}) {
    const t = useTranslations('setup.residenceStep.compare')
    return (
        <div className="flex w-full flex-1 flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-heading-s">{t('title')}</h1>
                <p className="text-body-m text-foreground-secondary">{t('description')}</p>
            </div>
            {/* Client-derived from the restriction tiers and the same rail map as Unlock payments. */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-4">
                <Divider orientation="vertical" className="col-start-2 row-span-3 row-start-1" />
                {[residence, citizenship].map((iso2) => {
                    const summary = restrictionsSettled
                        ? residenceAvailability(restrictionSets, iso2)
                        : { available: [], unavailable: [], multiCurrency: false }
                    return (
                        // subgrid rows: the lists and the notes line up when one country name wraps
                        <section key={iso2} className="row-span-3 grid grid-rows-subgrid">
                            <h2 className="mb-3 flex flex-col items-start gap-2 text-heading-card break-words">
                                <Image
                                    src={getFlagUrl(iso2.toLowerCase())}
                                    alt=""
                                    width={64}
                                    height={64}
                                    className="size-8 shrink-0 rounded-full object-cover"
                                />
                                {labelOf(iso2)}
                            </h2>
                            <BulletList
                                size="xs"
                                items={[
                                    ...summary.available
                                        .filter((item) => item !== 'p2p')
                                        .map((item) => t(`items.${item}`)),
                                    ...summary.unavailable.map((item) => (
                                        <span key={item} className="line-through">
                                            {t(`missing.${item}`)}
                                        </span>
                                    )),
                                    t('items.p2p'),
                                ]}
                            />
                            {/* A rail in another currency only pays out into an account on that
                                network, so it is a condition, not a benefit of living here. */}
                            {summary.multiCurrency && (
                                <p className="mt-2 text-body-xs text-foreground-secondary">{t('multiCurrencyNote')}</p>
                            )}
                        </section>
                    )
                })}
            </div>
            <Callout priority="info" hideIcon>
                <MiniHeader className="mb-1 text-inherit">{t('guideTitle')}</MiniHeader>
                <p>{t('guideDeclaration')}</p>
            </Callout>
            <SetupFooter
                actions={
                    <div className="flex w-full flex-col gap-3">
                        {[citizenship, residence].map((iso2) => (
                            <Button
                                key={iso2}
                                shadowSize="4"
                                variant={iso2 === residence ? 'primary' : 'secondary'}
                                onClick={() => onChoose(iso2)}
                                disabled={busy}
                                loading={busy}
                                data-testid={`setup-residence-select-${iso2}`}
                            >
                                {t('selectCountry', { country: labelOf(iso2) })}
                            </Button>
                        ))}
                    </div>
                }
            />
        </div>
    )
}
