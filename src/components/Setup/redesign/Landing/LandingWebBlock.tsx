'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import Badge from '@/components/Global/Badges/Badge'
import StoreButtons from '@/components/Migration/StoreButtons'
import { MIGRATION_SURFACES, TEST_WEB_SIGNUP } from '@/constants/migration.consts'
import { DeviceType } from '@/hooks/useGetDeviceType'

/**
 * The web download-only landing's panel block, as dev: on the web new sign-ups are app-only, so the store buttons lead
 * and Log in drops to a text link for existing accounts (contract P1 S6, K13).
 */
export function LandingWebBlock({
    deviceType,
    isLoggingIn,
    onLoginClick,
    onSignUpClick,
    onStoreClick,
    accountDeletedCallout,
    recoveryLink,
}: {
    deviceType: DeviceType
    isLoggingIn: boolean
    onLoginClick: () => void
    onSignUpClick: () => void
    onStoreClick: (store: string) => void
    accountDeletedCallout: ReactNode
    recoveryLink: ReactNode
}) {
    const t = useTranslations('setup')
    const tMigration = useTranslations('migration')
    return (
        <div className="flex flex-col gap-6">
            {accountDeletedCallout}
            <div className="space-y-2 pb-2">
                {/* heading only above the desktop QR: a lone store button explains itself */}
                {deviceType === DeviceType.WEB && (
                    <p className="text-center text-label-l text-foreground-primary">{tMigration('banner.title')}</p>
                )}
                <StoreButtons surface={MIGRATION_SURFACES.SETUP} onStoreClick={onStoreClick} />
            </div>
            <div className="text-center">
                <LinkButton onClick={onLoginClick} disabled={isLoggingIn}>
                    {tMigration('qr.logIn')}
                </LinkButton>
            </div>
            {/* pt-1: two stacked text links need ~28px between their hit areas */}
            {recoveryLink && (
                <div className="pt-1 text-center" data-testid="landing-recovery-link">
                    {recoveryLink}
                </div>
            )}
            {/* Not a product element: staging, previews and local builds only, so the team can still create web
                accounts. The dashed frame and badge keep it from reading as a real option in screenshots. */}
            {TEST_WEB_SIGNUP && (
                <div className="flex items-center justify-center gap-3 rounded-sm border-[1.5px] border-dashed border-border-default p-3">
                    <Badge status="neutral" customText={t('landing.testBuild')} />
                    <LinkButton onClick={onSignUpClick}>{t('landing.testSignUp')}</LinkButton>
                </div>
            )}
        </div>
    )
}
