'use client'

import { CountryCombobox } from '@/components/Common/CountryCombobox'
import ActionModal from '@/components/Global/ActionModal'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import { useResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { updateUserById } from '@/app/actions/users'
import posthog from 'posthog-js'
import { buildResidenceCountryOptions } from '@/utils/residence-options'
import { readSecondResidence, storeDeclaredResidence, storeSecondResidence } from '@/utils/declared-residence.storage'
import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

interface ResidenceChangeModalProps {
    visible: boolean
    onClose: () => void
    userId: string | undefined
    /** current declared residence, preselected */
    declared: string | null
    /** The durable second document country from /users/me. */
    declaredSecond?: string | null
    /** KYC-verified residence, when one exists */
    verified: string | null
    /** when the escalating change cooldown lifts (ISO); null = change allowed now */
    nextChangeAllowedAt?: string | null
    /** refetch the user so the new declared residence lands everywhere */
    onSaved: () => Promise<unknown> | void
    /** start identity re-verification at the current level (existing restart primitive) */
    /** called with the newly declared residence when the user asked to submit documents */
    onReverify: (iso2: string) => void
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
    declaredSecond,
    verified,
    nextChangeAllowedAt,
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

    const countryOptions = useMemo(() => buildResidenceCountryOptions(locale), [locale])

    const selectedRestrictions = deriveResidenceRestrictionsFrom(restrictionSets, selected || null)
    const differsFromVerified = !!verified && !!selected && selected !== verified

    // Escalating change cooldown (server-enforced; this is the honest preface).
    // Gate only ACTUAL changes: re-saving the current country stays allowed.
    const cooldownUntilMs = nextChangeAllowedAt ? Date.parse(nextChangeAllowedAt) : NaN
    const cooldownActive = Number.isFinite(cooldownUntilMs) && cooldownUntilMs > Date.now()
    const isActualChange = !!selected && !!declared && selected !== declared
    const changeBlocked = cooldownActive && isActualChange
    const cooldownDate = cooldownActive
        ? new Date(cooldownUntilMs).toLocaleString(locale, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          })
        : null

    const save = async (reverifyAfter: boolean) => {
        if (!userId || !selected || isSaving) return false
        setIsSaving(true)
        setError(null)
        try {
            // Promoting the second document country is a REORDER, not a move.
            // Both slots are durable on the server, so the swap has to travel
            // WITH the request — writing only the primary leaves the server
            // pair as selected/selected and loses the outgoing country for
            // good (the local mirror would merely hide that on this device).
            // A pick in neither slot is a genuine move: the second stands.
            // Server value first: the device mirror is absent on a fresh
            // device, and trusting it there is what let a reorder wipe the
            // outgoing country. The mirror is the fallback for the window
            // before the /users/me field reaches production.
            const previousSecond = declaredSecond ?? readSecondResidence(userId)
            const isReorder = !!declared && previousSecond === selected
            const result = await updateUserById({
                userId,
                residenceCountry: selected,
                ...(isReorder ? { secondResidenceCountry: declared } : {}),
            })
            if (result.error) {
                setError(result.error)
                return false
            }
            storeDeclaredResidence(userId, selected)
            if (isReorder) storeSecondResidence(userId, declared)
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
            if (reverifyAfter) onReverify(selected)
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
                    <CountryCombobox
                        options={countryOptions}
                        placeholder={t('countryPlaceholder')}
                        value={selected || undefined}
                        onValueChange={setSelected}
                    />
                    {cooldownActive && cooldownDate && (
                        <p className="text-body-xs text-foreground-secondary">
                            {t('cooldownNote', { until: cooldownDate })}
                        </p>
                    )}
                    {differsFromVerified && (
                        <p className="text-body-xs text-foreground-secondary">{t('verifiedMismatchNote')}</p>
                    )}
                    {(selectedRestrictions.banking || selectedRestrictions.card) && (
                        <p className="text-body-xs text-foreground-secondary">
                            {selectedRestrictions.banking && selectedRestrictions.card
                                ? t('fullRestrictionNote')
                                : selectedRestrictions.card
                                  ? t('cardRestrictionNote')
                                  : t('bankingRestrictionNote')}
                        </p>
                    )}
                    {error && <p className="text-body-xs text-error">{error}</p>}
                </div>
            }
            descriptionClassName="text-black"
            icon="globe"
            iconContainerClassName="bg-action-primary"
            iconProps={{ className: 'text-black' }}
            ctas={[
                {
                    shadowSize: '4',
                    text: isSaving ? tCommon('loading') : t('save'),
                    disabled: isSaving || !selected || !userId || changeBlocked,
                    onClick: () => void save(false),
                    variant: 'purple',
                },
                ...(differsFromVerified
                    ? [
                          {
                              text: t('saveAndReverify'),
                              disabled: isSaving || changeBlocked,
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
