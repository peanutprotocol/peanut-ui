'use client'

import { useCallback, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import { useQueryClient } from '@tanstack/react-query'
import ActionModal from '@/components/Global/ActionModal'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useModalsContext } from '@/context/ModalsContext'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import ResidenceChangeDrawer from '@/components/Profile/views/ResidenceChangeDrawer'
import { countryData } from '@/components/AddMoney/consts'
import { LIMITS } from '@/constants/query.consts'
import { useAuth } from '@/context/authContext'
import { useBankRows } from '@/hooks/useBankRows'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { pendingResidenceCountry } from '@/utils/residence-profile'
import ProfileMenuItem from './ProfileMenuItem'

/**
 * The country Peanut is set up for, and the drawer that changes it (Slava,
 * 2026-10-27: "Move Residence to Profile"). `?open=residence` opens the drawer,
 * as links from card recovery and Add money do.
 */
export default function ResidenceMenuItem() {
    const t = useTranslations('profile.unlockPayments')
    const tRegions = useTranslations('profile.regions')
    const tCommon = useTranslations('common')
    const locale = useLocale()
    const { user, fetchUser } = useAuth()
    const queryClient = useQueryClient()
    const { setIsSupportModalOpen } = useModalsContext()
    const { residence, residenceIso2, secondResidenceIso2 } = useBankRows()
    const [openView, setOpenView] = useQueryState('open', parseAsString)
    const [open, setOpen] = useState(false)
    const [reverifyTarget, setReverifyTarget] = useState<string | null>(null)
    const [errorAcknowledged, setErrorAcknowledged] = useState(false)
    const flow = useMultiPhaseKycFlow({
        onKycSuccess: () => setReverifyTarget(null),
        onManualClose: () => setReverifyTarget(null),
    })

    const close = useCallback(() => {
        setOpen(false)
        void setOpenView(null, { history: 'replace' })
    }, [setOpenView])

    const countryName = (iso2: string | null) =>
        iso2
            ? localizedCountryTitle(locale, {
                  iso2,
                  title: countryData.find((c) => c.iso2?.toUpperCase() === iso2)?.title ?? iso2,
              })
            : null
    const pendingCountry = pendingResidenceCountry(residence)
    const status = !residenceIso2
        ? t('residence.unknown')
        : pendingCountry
          ? t('residence.pendingReverify', { country: countryName(pendingCountry) ?? pendingCountry })
          : residence?.verified?.country
            ? undefined
            : t('residence.unverified')

    return (
        <>
            <ProfileMenuItem
                icon="globe"
                label={t('residence.label')}
                endText={countryName(residenceIso2) ?? undefined}
                badge={status}
                onClick={() => setOpen(true)}
            />
            <ResidenceChangeDrawer
                visible={open || openView === 'residence'}
                onClose={close}
                userId={user?.user?.userId}
                declared={residence?.declared?.country ?? null}
                declaredSecond={secondResidenceIso2}
                verified={residence?.verified?.country ?? null}
                pending={pendingCountry}
                onSaved={async () => {
                    // Card eligibility and limits follow the declared country.
                    await Promise.all([
                        fetchUser(),
                        queryClient.invalidateQueries({ queryKey: ['card-info'] }),
                        queryClient.invalidateQueries({ queryKey: [LIMITS] }),
                    ])
                }}
                onReverify={(targetCountry) => {
                    setReverifyTarget(targetCountry)
                    setErrorAcknowledged(false)
                    void flow.handleResidenceChange(targetCountry)
                }}
            />
            <ActionModal
                visible={!!reverifyTarget && !!flow.error && !flow.errorCooldown && !errorAcknowledged}
                onClose={() => setErrorAcknowledged(true)}
                title={tRegions('initError.retriableTitle')}
                description={flow.error || tCommon('genericError')}
                tone="error"
                ctas={[
                    {
                        text: tCommon('tryAgain'),
                        variant: 'primary',
                        shadowSize: '4',
                        disabled: flow.isLoading,
                        onClick: () => reverifyTarget && void flow.handleResidenceChange(reverifyTarget),
                    },
                ]}
                // support is the escape after a failed retry, not a second way in
                footer={
                    <div className="flex justify-center">
                        <LinkButton
                            onClick={() => {
                                setErrorAcknowledged(true)
                                setIsSupportModalOpen(true)
                            }}
                        >
                            {tCommon('contactSupport')}
                        </LinkButton>
                    </div>
                }
            />
            <SumsubKycModals flow={flow} />
        </>
    )
}
