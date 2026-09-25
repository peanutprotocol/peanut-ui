'use client'

import { useLocale, useTranslations } from 'next-intl'
import { createElement, useMemo, useState } from 'react'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { CountryCombobox } from '@/components/Common/CountryCombobox'
import { buildResidenceCountryOptions } from '@/utils/residence-options'

// copied from Residence.tsx: an underlined text link is ~20px tall; the
// `after:` pseudo-element grows the tap target to 44px without moving the text
const UNDERLINED_LINK =
    'relative text-body-s underline underline-offset-2 after:absolute after:inset-x-0 after:-inset-y-3.5 focus-visible:outline-[3px] focus-visible:outline-action-focus'

/**
 * Setup residence, "Have documents from more than one country?"
 * (Residence.tsx). Before: an underlined button with aria-expanded and no
 * chevron. After: Accordion variant="link"; closing still clears the second
 * pick, now in onValueChange.
 */
export function ResidenceSecondCountryDemo({ mode }: { mode: 'before' | 'after' }) {
    const t = useTranslations('setup')
    const locale = useLocale()
    const countryOptions = useMemo(() => buildResidenceCountryOptions(locale), [locale])
    const [residenceCountry, setResidenceCountry] = useState('AR')
    const [secondResidenceCountry, setSecondResidenceCountry] = useState('')
    const [showSecondCountry, setShowSecondCountry] = useState(false)

    const secondCombobox = (
        <CountryCombobox
            options={countryOptions}
            placeholder={t('residenceStep.secondCountryPlaceholder')}
            value={secondResidenceCountry || undefined}
            onValueChange={(value) => setSecondResidenceCountry(value)}
        />
    )

    return (
        <div className="flex w-full flex-col gap-2">
            <h1 className="w-full text-left text-heading-xs leading-tight">{t('steps.residence.title')}</h1>
            <p className="mb-1 text-body-s text-foreground-secondary">{t('steps.residence.description')}</p>
            <CountryCombobox
                options={countryOptions}
                placeholder={t('residenceStep.countryPlaceholder')}
                value={residenceCountry}
                onValueChange={setResidenceCountry}
            />
            {mode === 'before' ? (
                <>
                    {/* the raw button Residence.tsx ships today. createElement, not
                        JSX: dev-chrome.test bans raw <button> in dev tool chrome,
                        and this is a copy of product markup, not chrome */}
                    {createElement(
                        'button',
                        {
                            type: 'button',
                            className: `self-start text-left ${UNDERLINED_LINK}`,
                            'aria-expanded': showSecondCountry,
                            onClick: () => {
                                if (showSecondCountry && secondResidenceCountry) setSecondResidenceCountry('')
                                setShowSecondCountry((current) => !current)
                            },
                        },
                        t('residenceStep.multiDocLink')
                    )}
                    {showSecondCountry && secondCombobox}
                </>
            ) : (
                <Accordion
                    type="single"
                    collapsible
                    variant="link"
                    onValueChange={(value) => {
                        // closing clears the pick: a hidden second residence
                        // must not be sent to analytics or saved
                        if (!value) setSecondResidenceCountry('')
                    }}
                >
                    <Accordion.Item value="second-country">
                        <Accordion.Trigger>{t('residenceStep.multiDocLink')}</Accordion.Trigger>
                        <Accordion.Content>{secondCombobox}</Accordion.Content>
                    </Accordion.Item>
                </Accordion>
            )}
        </div>
    )
}
