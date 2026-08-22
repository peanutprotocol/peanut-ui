'use client'

import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import ActionModal from '@/components/Global/ActionModal'
import { countryData } from '@/components/AddMoney/consts'
import { SUPPLEMENTAL_RESIDENCE_OPTIONS } from '@/constants/residence.consts'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import { useResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { updateUserById } from '@/app/actions/users'
import posthog from 'posthog-js'
import { storeDeclaredResidence } from '@/utils/declared-residence.storage'
import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { localizedCountryTitle } from '@/utils/country-name.utils'

interface ResidenceChangeModalProps {
    visible: boolean
    onClose: () => void
    userId: string | undefined
    /** current declared residence, preselected */
    declared: string | null
    /** KYC-verified residence, when one exists */
    verified: string | null
    /** refetch the user so the new declared residence lands everywhere */
    onSaved: () => Promise<unknown> | void
    /** start identity re-verification at the current level (existing restart primitive) */
    onReverify: () => void
}

/**
 * The residency-change flow, anchored on the Unlock payments residence row.
 *
 * Declared residence saves immediately (it is advisory prequalification).
 * When a verified residence exists and the pick differs, the modal says
 * plainly that rails keep working on the verified residence until the user
 * re-verifies with new-country documents, and offers that re-verification as
 * an explicit second action — never as a silent side effect of saving.
 */
const ResidenceChangeModal = ({
    visible,
    onClose,
    userId,
    declared,
    verified,
    onSaved,
    onReverify,
}: ResidenceChangeModalProps) => {
    const t = useTranslations('profile.unlockPayments.changeModal')
    const tCommon = useTranslations('common')
    const restrictionSets = useResidenceRestrictionSets()
    const locale = useLocale()
    const [selected, setSelected] = useState<string>(declared ?? verified ?? '')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // The parent keeps this modal mounted and toggles `visible`, so the
    // useState initializer only ever ran on first mount — re-seed the pick
    // each time the modal opens (the user may have loaded late, or saved).
    useEffect(() => {
        if (!visible) return
        setSelected(declared ?? verified ?? '')
        setError(null)
    }, [visible, declared, verified])

    const countryOptions = useMemo(() => {
        const options = countryData
            .filter((c) => c.type === 'country' && !!c.iso2)
            .map((c) => ({
                label: localizedCountryTitle(locale, { iso2: c.iso2!.toUpperCase(), title: c.title }),
                value: c.iso2!.toUpperCase(),
            }))
        const present = new Set(options.map((o) => o.value))
        for (const extra of SUPPLEMENTAL_RESIDENCE_OPTIONS) {
            if (!present.has(extra.iso2)) {
                options.push({
                    label: localizedCountryTitle(locale, { iso2: extra.iso2, title: extra.title }),
                    value: extra.iso2,
                })
            }
        }
        return options.sort((a, b) => a.label.localeCompare(b.label, locale))
    }, [locale])

    const selectedRestrictions = deriveResidenceRestrictionsFrom(restrictionSets, selected || null)
    const differsFromVerified = !!verified && !!selected && selected !== verified

    const save = async (reverifyAfter: boolean) => {
        if (!userId || !selected || isSaving) return false
        setIsSaving(true)
        setError(null)
        try {
            const result = await updateUserById({ userId, residenceCountry: selected })
            if (result.error) {
                setError(result.error)
                return false
            }
            storeDeclaredResidence(selected)
            posthog.capture(ANALYTICS_EVENTS.RESIDENCE_CHANGED, {
                residence_country: selected,
                differed_from_verified: differsFromVerified,
                reverify_started: reverifyAfter,
            })
            // The write already succeeded — a failed user refetch must not trap
            // the user in the modal or surface as an unhandled rejection.
            try {
                await onSaved()
            } catch (e) {
                console.error('failed to refetch user after residence change:', e)
            }
            onClose()
            if (reverifyAfter) onReverify()
            return true
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={t('title')}
            description={
                <div className="flex flex-col gap-3 text-left">
                    <p>{t('description')}</p>
                    <BaseSelect
                        options={countryOptions}
                        placeholder={t('countryPlaceholder')}
                        value={selected || undefined}
                        onValueChange={setSelected}
                    />
                    {differsFromVerified && <p className="text-xs text-grey-1">{t('verifiedMismatchNote')}</p>}
                    {(selectedRestrictions.banking || selectedRestrictions.card) && (
                        <p className="text-xs text-grey-1">
                            {selectedRestrictions.banking && selectedRestrictions.card
                                ? t('fullRestrictionNote')
                                : selectedRestrictions.card
                                  ? t('cardRestrictionNote')
                                  : t('bankingRestrictionNote')}
                        </p>
                    )}
                    {error && <p className="text-xs text-error">{error}</p>}
                </div>
            }
            descriptionClassName="text-black"
            icon="globe"
            iconContainerClassName="bg-primary-1"
            iconProps={{ className: 'text-black' }}
            ctas={[
                {
                    shadowSize: '4',
                    text: isSaving ? tCommon('loading') : t('save'),
                    disabled: isSaving || !selected || !userId,
                    onClick: () => void save(false),
                    variant: 'purple',
                },
                ...(differsFromVerified
                    ? [
                          {
                              text: t('saveAndReverify'),
                              disabled: isSaving,
                              onClick: () => void save(true),
                              variant: 'stroke' as const,
                          },
                      ]
                    : []),
            ]}
        />
    )
}

export default ResidenceChangeModal
