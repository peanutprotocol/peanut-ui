'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { Section } from '@/components/0_Bruddle/Section'
import { Icon } from '@/components/Global/Icons/Icon'
import { MAX_QR_PAYMENT_AMOUNT_FOREIGN } from '@/constants/payment.consts'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { getQrCountriesWithFlags } from '@/features/limits/consts'

/**
 * Per-country QR limits (BridgeLimitsView). Before: a flag + name composed
 * inside the text trigger. After: the flag moves to `leading` and the name to
 * `title`, so the row matches every other flag row in the app.
 */
export function QrLimitsDemo({ mode }: { mode: 'before' | 'after' }) {
    const t = useTranslations('limits.provider')
    const [expandedCountry, setExpandedCountry] = useState<string | undefined>('argentina')
    const qrCountries = getQrCountriesWithFlags()
    const limit = (
        <div className="flex items-center gap-2">
            <Icon name="check" className="text-green-500" size={16} />
            <span>{t('qrPayLimit', { amount: `$${MAX_QR_PAYMENT_AMOUNT_FOREIGN.toLocaleString()}` })}</span>
        </div>
    )

    return (
        <Section title={t('qrPaymentLimits')}>
            <Accordion
                type="single"
                collapsible
                value={expandedCountry}
                onValueChange={(value) => setExpandedCountry(value || undefined)}
            >
                {qrCountries.map((country) => (
                    <Accordion.Item key={country.id} value={country.id}>
                        {mode === 'before' ? (
                            <Accordion.Trigger>
                                <div className="flex items-center gap-2">
                                    <Image
                                        src={country.flag}
                                        alt=""
                                        width={24}
                                        height={24}
                                        className="size-5 rounded-full object-cover"
                                    />
                                    <span>{country.name}</span>
                                </div>
                            </Accordion.Trigger>
                        ) : (
                            <Accordion.Trigger
                                leading={<CorridorFlag iso2={country.flagCode} />}
                                title={country.name}
                            />
                        )}
                        <Accordion.Content>{limit}</Accordion.Content>
                    </Accordion.Item>
                ))}
            </Accordion>
        </Section>
    )
}
