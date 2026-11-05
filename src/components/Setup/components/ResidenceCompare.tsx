'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Divider } from '@/components/0_Bruddle/Divider'
import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { type ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { useKycIntents } from '@/hooks/useKycIntents'
import { type AvailabilityItemKey, residenceAvailability } from '@/utils/residence-availability'
import SetupFooter from './SetupFooter'

/** The per-currency bank rails, shown together as one "Bank account" item. */
const BANK_ACCOUNT_CURRENCY = {
    usdAch: 'USD',
    eurSepa: 'EUR',
    gbpFps: 'GBP',
    spei: 'MXN',
} as const satisfies Partial<Record<AvailabilityItemKey, string>>
type BankAccountRail = keyof typeof BANK_ACCOUNT_CURRENCY
const isBankAccountRail = (item: AvailabilityItemKey): item is BankAccountRail => item in BANK_ACCOUNT_CURRENCY

/** "A, B or C" in the app locale; English without the serial comma, as the product copy reads. */
function formatOrList(locale: string, parts: string[]): string {
    const listLocale = locale.toLowerCase().startsWith('en') ? 'en-GB' : locale
    return new Intl.ListFormat(listLocale, { type: 'disjunction' }).format(parts)
}

/**
 * Residence and nationality differ: which of the two Peanut is set up for,
 * with what each unlocks. One tap picks the country and continues.
 */
export function ResidenceCompare({
    residence,
    nationality,
    labelOf,
    restrictionSets,
    busy,
    onChoose,
    title,
    description,
}: {
    residence: string
    nationality: string
    labelOf: (country: string) => string
    restrictionSets: ResidenceRestrictionSets | null
    busy: boolean
    onChoose: (country: string) => void
    /** In place of the sign-up wording, e.g. when the uploaded ID is from the other country. */
    title?: string
    description?: string
}) {
    const t = useTranslations('setup.residenceStep.compare')
    const locale = useLocale()
    // What a column lists: the bank rails merged into one "Bank account" item at the
    // first rail's place, currencies in the served order, like the Payment methods
    // drawer's bank row. Universal P2P goes last; what a residence rules out is not shown.
    const itemsOf = (available: readonly AvailabilityItemKey[]): string[] => {
        const currencies = available
            .filter(isBankAccountRail)
            .map((rail) => t(`currencies.${BANK_ACCOUNT_CURRENCY[rail]}`))
        const items: string[] = []
        let bankAccountListed = false
        for (const item of available) {
            if (item === 'p2p') continue
            if (isBankAccountRail(item)) {
                if (!bankAccountListed)
                    items.push(t('items.bankAccount', { currencies: formatOrList(locale, currencies) }))
                bankAccountListed = true
            } else items.push(t(`items.${item}`))
        }
        return [...items, t('items.p2p')]
    }
    // Each country's offers come from the rules the verification applies.
    const intentsOf = { [residence]: useKycIntents(residence), [nationality]: useKycIntents(nationality) }
    return (
        <div className="flex w-full flex-1 flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-heading-s">{title ?? t('title')}</h1>
                <p className="text-body-m text-foreground-secondary">{description ?? t('description')}</p>
            </div>
            {/* The server's answer per country (GET /config/kyc-intents); the tiers only if it failed. */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-4">
                <Divider orientation="vertical" className="col-start-2 row-span-3 row-start-1" />
                {[residence, nationality].map((iso2) => {
                    const { intents, settled } = intentsOf[iso2]
                    const summary =
                        settled && (intents || restrictionSets !== null)
                            ? residenceAvailability(restrictionSets, iso2, intents)
                            : { available: [], multiCurrency: false }
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
                            <BulletList size="xs" items={itemsOf(summary.available)} />
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
                        {[residence, nationality].map((iso2) => (
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
