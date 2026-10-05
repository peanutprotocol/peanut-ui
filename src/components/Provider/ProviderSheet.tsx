'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { PROVIDERS } from '@/constants/providers.consts'
import type { ProviderId } from '@/types/provider.types'

interface ProviderSheetProps {
    providerId: ProviderId
    open: boolean
    onClose: () => void
    /** set when the sheet opens from inside another drawer */
    nested?: boolean
    /** QR payments: the money leaves Peanut's own account at Manteca */
    pooledAccount?: boolean
}

/**
 * Who the provider is, in legal terms (TASK-23295, Brazil Resolution 520).
 * Only fields present in the registry render, so an unverified fact never shows.
 */
export const ProviderSheet = ({ providerId, open, onClose, nested, pooledAccount }: ProviderSheetProps) => {
    const t = useTranslations('provider')
    const tCommon = useTranslations('common')
    const provider = PROVIDERS[providerId]
    const sumsub = PROVIDERS.sumsub

    const rows: { label: string; value: React.ReactNode }[] = []
    if (provider.legalName) rows.push({ label: t('field.legalName'), value: provider.legalName })
    if (provider.registeredOffice)
        rows.push({
            label: t('field.registeredOffice'),
            value: provider.registeredOffice.map((line) => (
                <span key={line} className="block">
                    {line}
                </span>
            )),
        })
    if (provider.registration) rows.push({ label: t('field.registration'), value: provider.registration })
    if (provider.regulator) rows.push({ label: t('field.regulator'), value: provider.regulator })
    rows.push({ label: t('field.role'), value: t(`role.${provider.role}`) })
    if (pooledAccount) rows.push({ label: t('field.paidFrom'), value: t('pooledAccount') })
    // sumsub checks id on bridge's behalf, so it belongs on every bridge sheet
    if (provider.role === 'bridge')
        rows.push({ label: t('field.identityCheck'), value: `${sumsub.brand} (${sumsub.legalName})` })
    rows.push({ label: t('field.peanut'), value: t('peanutValue') })

    // the relationship line is only true when the user accepted the provider's terms.
    // a qr payment leaves peanut's own account, so it never applies there
    const intro =
        provider.role === 'thirdNational'
            ? t('cardSheetIntro', { brand: provider.brand })
            : provider.userContract && !pooledAccount
              ? `${t('sheetIntro', { brand: provider.brand })} ${t('relationship', { brand: provider.brand })}`
              : t('sheetIntro', { brand: provider.brand })

    return (
        <Drawer
            nested={nested}
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent className="py-4">
                <div className="flex flex-col gap-4 text-left">
                    <DrawerHeader className="gap-2 p-0 text-left sm:text-left">
                        <DrawerTitle>{provider.brand}</DrawerTitle>
                    </DrawerHeader>
                    <p className="text-body-s text-foreground-primary">{intro}</p>
                    <div>
                        {rows.map((row, index) => (
                            <PaymentInfoRow
                                key={row.label}
                                label={row.label}
                                value={row.value}
                                hideBottomBorder={index === rows.length - 1}
                            />
                        ))}
                    </div>
                    {(provider.termsUrl || provider.privacyUrl) && (
                        <div className="flex gap-6">
                            {provider.termsUrl && (
                                <LinkButton href={provider.termsUrl} external icon>
                                    {t('field.terms')}
                                </LinkButton>
                            )}
                            {provider.privacyUrl && (
                                <LinkButton href={provider.privacyUrl} external icon>
                                    {t('field.privacy')}
                                </LinkButton>
                            )}
                        </div>
                    )}
                    <Button variant="primary" shadowSize="4" className="w-full justify-center" onClick={onClose}>
                        {tCommon('gotIt')}
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
