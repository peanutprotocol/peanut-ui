'use client'

import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import NavHeader from '@/components/Global/NavHeader'
import { useParams } from 'next/navigation'
import { useMemo } from 'react'
import { countryData } from '@/components/AddMoney/consts'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import ShareButton from '@/components/Global/ShareButton'
import { type MantecaDepositResponseData } from '@/types/manteca.types'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { Icon } from '@/components/Global/Icons/Icon'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { Card } from '@/components/0_Bruddle/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import {
    MANTECA_ARG_DEPOSIT_CUIT,
    MANTECA_ARG_DEPOSIT_NAME,
    MANTECA_COUNTRIES_CONFIG,
} from '@/constants/manteca.consts'
import { shortenStringLong, formatCurrency } from '@/utils/general.utils'
import { useLocale, useTranslations } from 'next-intl'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ProviderHelp } from '@/components/Provider/ProviderHelp'
import { PROVIDERS } from '@/constants/providers.consts'

const MantecaDepositShareDetails = ({
    depositDetails,
    currencyAmount,
    arsStatus,
    onStartOver,
    onBack,
}: {
    depositDetails: MantecaDepositResponseData
    currencyAmount?: string | undefined
    arsStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'expired'
    onStartOver?: () => void
    // Parent owns step navigation — usually a setUrlState({ step: 'inputAmount' }).
    onBack: () => void
}) => {
    const params = useParams()
    const t = useTranslations('addMoney')
    const tCommon = useTranslations('common')
    const tWithdraw = useTranslations('withdraw')
    const tProvider = useTranslations('provider')
    const locale = useLocale()
    const currentCountryName = params.country as string

    const currentCountryDetails = useMemo(() => {
        // check if we have country params (from dynamic route)
        if (currentCountryName) {
            return countryData.find(
                (country) => country.type === 'country' && country.path === currentCountryName.toLowerCase()
            )
        }
        // Default to Argentina
        return countryData.find((c) => c.id === 'AR')
    }, [currentCountryName])

    const countryCodeForFlag = useMemo(() => {
        const countryId = currentCountryDetails?.id || 'AR'
        return countryId.toLowerCase()
    }, [currentCountryDetails])

    const depositAddressLabel = useMemo(() => {
        const fallback = t('manteca.depositAddress')
        if (!currentCountryDetails) return fallback
        return MANTECA_COUNTRIES_CONFIG[currentCountryDetails.id]?.depositAddressLabel ?? fallback
    }, [currentCountryDetails, t])
    // the deposit account belongs to manteca's local entity
    const providerId = currentCountryDetails?.id === 'BR' ? 'manteca-br' : 'manteca-ar'

    // BRL synthetics no longer carry these (QR-only) — but BRL routes to the QR
    // screen, never here; the fallback just keeps the ARS/static path total.
    const depositAddress = depositDetails.details.depositAddress ?? ''
    const shortenedAddress = depositAddress.length > 30 ? shortenStringLong(depositAddress, 10) : depositAddress
    const depositAlias = depositDetails.details.depositAlias
    const depositAmount = currencyAmount ?? depositDetails.stages['1'].thresholdAmount
    let usdAmount = depositDetails.stages['3'].amount
    const currencySymbol = depositDetails.stages['1'].asset
    const exchangeRate = depositDetails.details.price
    let networkFees = depositDetails.details.withdrawCostInAsset
    usdAmount = (Number(usdAmount) - Number(networkFees)).toString()
    if (Number(networkFees) < 0.01) {
        networkFees = '< 0.01 USD'
    } else {
        networkFees = `${formatCurrency(networkFees)} USD`
    }

    const generateShareText = () => {
        const textParts = []
        const currencySymbol = currentCountryDetails?.currency || 'ARS'

        textParts.push(t('manteca.shareAmount', { currency: currencySymbol, amount: depositAmount }))

        if (depositAddress) {
            textParts.push(t('manteca.shareLine', { label: depositAddressLabel, value: depositAddress }))
        }
        if (depositAlias) {
            textParts.push(t('manteca.shareAlias', { alias: depositAlias }))
        }
        textParts.push(t('manteca.shareOwnAccountOnly'))

        return textParts.join('\n')
    }

    if (arsStatus === 'expired')
        return (
            <div className="flex h-full w-full flex-col gap-6">
                <NavHeader title={t('title')} onPrev={onBack} />
                <Callout priority="attention" title={t('manteca.transferExpiredTitle')}>
                    {t('manteca.transferExpiredDescription')}
                </Callout>
                {onStartOver && (
                    <Button variant="primary" shadowSize="4" className="w-full" onClick={onStartOver}>
                        {t('manteca.startNewDeposit')}
                    </Button>
                )}
            </div>
        )

    if (arsStatus && arsStatus !== 'pending')
        return (
            <div className="flex h-full w-full flex-col gap-6">
                <NavHeader title={t('title')} onPrev={onBack} />
                <Callout priority={arsStatus === 'completed' ? 'success' : arsStatus === 'failed' ? 'error' : 'info'}>
                    {arsStatus === 'completed'
                        ? t('pix.depositReceived')
                        : arsStatus === 'processing'
                          ? t('processingDepositTitle')
                          : tCommon('genericError')}
                </Callout>
            </div>
        )

    const transferDeadline = arsStatus === 'pending' ? Date.parse(depositDetails.stages?.['1']?.expireAt ?? '') : NaN
    return (
        <div className="flex h-full w-full flex-col justify-start gap-8 self-start">
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="my-auto space-y-4 flex h-full w-full flex-col justify-center">
                {/* Amount Display Card */}
                <Card className="p-4">
                    <div className="space-x-3 flex items-center">
                        {/* a card shows its counterparty at 32, one leading element:
                            the flag, with the bank bubble if it fails to load */}
                        <AvatarWithBadge
                            size="s"
                            logo={getFlagUrl(countryCodeForFlag)}
                            fallback={<IconBubble {...CONCEPT_ICONS.bank} size="s" />}
                        />
                        <div>
                            <p className="flex items-center gap-1 text-center text-body-s text-foreground-secondary">
                                <Icon name="arrow-down" size={10} /> {t('manteca.youreAdding')}
                            </p>
                            <p className="text-heading-s text-foreground-primary">
                                {currencySymbol} {formatCurrency(depositAmount)}
                            </p>
                            <div className="text-heading-card text-foreground-primary">
                                ≈ {formatCurrency(usdAmount)} USD
                            </div>
                        </div>
                    </div>
                </Card>
                <Callout priority="attention" title={t('manteca.sendOnlyOwnAccountTitle')}>
                    {t('manteca.sendOnlyOwnAccountDescription')}
                </Callout>
                {Number.isFinite(transferDeadline) && (
                    <Callout priority="attention">
                        {t('manteca.transferDeadline', {
                            time: new Date(transferDeadline).toLocaleTimeString(locale, {
                                hour: 'numeric',
                                minute: '2-digit',
                            }),
                        })}
                    </Callout>
                )}
                <h2 className="font-bold">{t('manteca.accountDetails')}</h2>
                <Card className="space-y-0 rounded-sm px-4">
                    {depositAddress && (
                        <PaymentInfoRow
                            label={depositAddressLabel}
                            value={shortenedAddress}
                            copyValue={depositAddress}
                            allowCopy
                        />
                    )}
                    {depositAlias && <PaymentInfoRow label={t('manteca.alias')} value={depositAlias} allowCopy />}
                    {currentCountryDetails?.id === 'AR' && (
                        <>
                            <PaymentInfoRow label={t('manteca.razonSocial')} value={MANTECA_ARG_DEPOSIT_NAME} />
                            <PaymentInfoRow label={t('manteca.cuit')} value={MANTECA_ARG_DEPOSIT_CUIT} />
                        </>
                    )}
                    <PaymentInfoRow
                        label={t('manteca.exchangeRate')}
                        value={`1 USD = ${exchangeRate} ${currencySymbol}`}
                    />
                    <PaymentInfoRow
                        label={t('manteca.providerFees')}
                        value={networkFees}
                        moreInfoText={t('manteca.providerFeesInfo')}
                    />
                    <PaymentInfoRow label={tCommon('peanutFee')} value={tCommon('sponsoredByPeanut')} />
                    <PaymentInfoRow label={tWithdraw('bank.arrives')} value={t('manteca.etaInstant')} />
                    <PaymentInfoRow
                        hideBottomBorder
                        label={
                            <span className="flex items-center gap-1">
                                {tProvider('label.provider')}
                                <ProviderHelp providerId={providerId} />
                            </span>
                        }
                        value={PROVIDERS[providerId].brand}
                    />
                </Card>
            </div>

            <ShareButton
                generateText={async () => generateShareText()}
                title={t('manteca.shareTitle')}
                variant="primary"
                className="w-full"
            >
                {t('manteca.shareDetails')}
            </ShareButton>
        </div>
    )
}

export default MantecaDepositShareDetails
