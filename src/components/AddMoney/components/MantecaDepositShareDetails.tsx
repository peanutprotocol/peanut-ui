'use client'

import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import NavHeader from '@/components/Global/NavHeader'
import { useParams } from 'next/navigation'
import { useMemo } from 'react'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import Badge from '@/components/Global/Badges/Badge'
import { useExpiryCountdown } from '@/hooks/useExpiryCountdown'
import { countryData } from '@/components/AddMoney/consts'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import ShareButton from '@/components/Global/ShareButton'
import { type MantecaDepositResponseData } from '@/types/manteca.types'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Icon } from '@/components/Global/Icons/Icon'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { Card } from '@/components/0_Bruddle/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import ProcessingScreen from '@/components/Global/ProcessingScreen'
import {
    MANTECA_ARG_DEPOSIT_CUIT,
    MANTECA_ARG_DEPOSIT_NAME,
    MANTECA_COUNTRIES_CONFIG,
} from '@/constants/manteca.consts'
import { middleEllipsisAccount } from '@/utils/general.utils'
import { formatAmountNumber, formatFiatRate } from '@/utils/currency'
import { useLocale, useTranslations } from 'next-intl'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ProviderFinePrint } from '@/components/Provider/ProviderFinePrint'
import { RateHelpTrigger } from '@/features/rates-fees/RateInfoDrawer'

const MantecaDepositShareDetails = ({
    depositDetails,
    arsStatus,
    onStartOver,
    onBack,
    onSent,
    onContactSupport,
    onDone,
}: {
    depositDetails: MantecaDepositResponseData
    arsStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'expired'
    onStartOver?: () => void
    // Parent owns step navigation — usually a setUrlState({ step: 'inputAmount' }).
    onBack: () => void
    // "I've sent the transfer": leaves the flow, as on Bridge's bank details
    onSent?: () => void
    // an expired order may still get a late transfer: support reconciles it by hand
    onContactSupport?: () => void
    // Leaves the flow once the pesos arrived.
    onDone: () => void
}) => {
    const params = useParams()
    const t = useTranslations('addMoney')
    const tCommon = useTranslations('common')
    const tWithdraw = useTranslations('withdraw')
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
    // the deposit account belongs to manteca's local entity (Brazil's Pix lives on /add-money/pix)
    const providerId = 'manteca-ar'

    // the fallback keeps the static path total
    const depositAddress = depositDetails.details.depositAddress ?? ''
    // a 22-digit CVU fits one compact row as its first 10 and last 4 digits; copy and share keep it whole
    const shortenedAddress = middleEllipsisAccount(depositAddress, 17)
    const depositAlias = depositDetails.details.depositAlias
    // The order's own amount, at the price it locked. The amount step's figure is an estimate at an earlier
    // price, so next to the locked rate it looked short (26 Nov: ARS 1.780,39 shown for a 1.777,34 order).
    const depositAmount = depositDetails.stages['1'].thresholdAmount
    let usdAmount = depositDetails.stages['3'].amount
    const currencySymbol = depositDetails.stages['1'].asset
    const exchangeRate = depositDetails.details.price
    let networkFees = depositDetails.details.withdrawCostInAsset
    usdAmount = (Number(usdAmount) - Number(networkFees)).toString()
    // Argentines read "1,746.62" as 1.74: every number on this screen uses the app locale
    if (Number(networkFees) < 0.01) {
        networkFees = `< ${formatAmountNumber(0.01, 2, 2, locale)} USD`
    } else {
        networkFees = `${formatAmountNumber(networkFees, 2, 2, locale)} USD`
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

    // the countdown runs only while the order waits for the transfer. at zero the details stop
    // working, but only the API's own 'expired' (provider cancelled, no payment seen) may offer a
    // new order: a new one cancels this one, and a late transfer can still be on its way.
    const expiresAtMs = useMemo(() => {
        if (arsStatus !== 'pending') return null
        const ms = Date.parse(depositDetails.stages?.['1']?.expireAt ?? '')
        return Number.isFinite(ms) ? ms : null
    }, [arsStatus, depositDetails])
    const countdown = useExpiryCountdown(expiresAtMs, arsStatus === 'pending')
    const isLapsedUnconfirmed = arsStatus === 'pending' && countdown.isExpired

    if (isLapsedUnconfirmed)
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onBack} />
                <ProcessingScreen
                    title={t('manteca.orderCheckingTitle')}
                    description={t('manteca.orderCheckingDescription')}
                />
            </PageStack>
        )

    if (arsStatus === 'expired')
        return (
            <div className="flex h-full w-full flex-col gap-8">
                <NavHeader title={t('title')} onPrev={onBack} />
                <div className="my-auto flex flex-col gap-6">
                    <Card className="flex flex-col items-center gap-4 p-6 text-center">
                        <IconBubble icon="clock" size="l" color="yellow" />
                        <div className="flex flex-col gap-1">
                            <p className="text-heading-s text-foreground-primary">
                                {currencySymbol} {formatAmountNumber(depositAmount, 2, 2, locale)}
                            </p>
                            <p className="text-body-s text-foreground-secondary">
                                {t('manteca.transferExpiredDescription')}
                            </p>
                        </div>
                        {onContactSupport && (
                            <LinkButton onClick={onContactSupport}>{tCommon('contactSupport')}</LinkButton>
                        )}
                    </Card>
                    {onStartOver && (
                        <Button variant="primary" className="w-full" onClick={onStartOver}>
                            {t('manteca.startNewDeposit')}
                        </Button>
                    )}
                </div>
            </div>
        )

    // The pesos reached Manteca: the bank details would invite a second transfer, and back would offer the amount again.
    if (arsStatus === 'processing')
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onDone} />
                <ProcessingScreen
                    title={t('manteca.paymentReceivedTitle')}
                    description={t('manteca.paymentReceivedDescription')}
                />
            </PageStack>
        )

    if (arsStatus === 'completed')
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onDone} />
                <PageStack.Center className="items-center text-center">
                    <IconBubble icon="check" size="l" color="green" />
                    <TitleBlock align="center" title={t('depositReceived')} description={t('balanceUpdated')} />
                    <Button variant="primary" className="w-full" onClick={onDone}>
                        {tCommon('done')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )

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
                                {currencySymbol} {formatAmountNumber(depositAmount, 2, 2, locale)}
                            </p>
                            {/* no "≈": the order locked this price when it was created */}
                            <div className="text-heading-card text-foreground-primary">
                                {formatAmountNumber(usdAmount, 2, 2, locale)} USD
                            </div>
                        </div>
                    </div>
                </Card>
                <h2 className="text-label-l text-foreground-primary">{t('manteca.sendTo')}</h2>
                {/* compact label-left rows, the card draws the dashed dividers */}
                <Card className="divide-y divide-dashed divide-border-default px-4 py-0">
                    {depositAddress && (
                        <DataRow
                            label={depositAddressLabel}
                            value={shortenedAddress}
                            copyValue={depositAddress}
                            allowCopy
                        />
                    )}
                    {depositAlias && <DataRow label={t('manteca.alias')} value={depositAlias} allowCopy />}
                    {currentCountryDetails?.id === 'AR' && (
                        <>
                            <DataRow label={t('manteca.razonSocial')} value={MANTECA_ARG_DEPOSIT_NAME} />
                            <DataRow label={t('manteca.cuit')} value={MANTECA_ARG_DEPOSIT_CUIT} />
                        </>
                    )}
                    {/* something waits on the user: the pending badge, as on the Pix code */}
                    {countdown.timeLeft && (
                        <DataRow
                            label={t('manteca.validFor')}
                            value={<Badge status="pending" customText={countdown.timeLeft} />}
                        />
                    )}
                </Card>
                {/* rate, fees and arrival keep today's values, folded so the details lead */}
                <Accordion type="single" collapsible>
                    <Accordion.Item value="rate-fees">
                        <Accordion.Trigger title={t('manteca.rateFeesArrival')} />
                        <Accordion.Content className="divide-y divide-dashed divide-border-default py-0">
                            <DataRow
                                label={
                                    <span className="flex items-center gap-1">
                                        {t('manteca.exchangeRate')}
                                        <RateHelpTrigger
                                            currency={currencySymbol}
                                            lockedRate={Number(exchangeRate)}
                                            lockMode="cbu"
                                        />
                                    </span>
                                }
                                value={`1 USD = ${formatFiatRate(exchangeRate, locale)} ${currencySymbol}`}
                            />
                            <DataRow
                                label={t('manteca.providerFees')}
                                value={networkFees}
                                moreInfoText={t('manteca.providerFeesInfo')}
                            />
                            <DataRow label={tWithdraw('bank.arrives')} value={t('manteca.etaInstant')} />
                        </Accordion.Content>
                    </Accordion.Item>
                </Accordion>
                {/* the one warning, next to the button where the user acts */}
                <Callout priority="attention" title={t('manteca.sendOnlyOwnAccountTitle')}>
                    {t('manteca.sendOnlyOwnAccountDescription')}
                </Callout>
            </div>

            <ShareButton
                generateText={async () => generateShareText()}
                title={t('manteca.shareTitle')}
                variant="primary"
                className="w-full"
            >
                {t('manteca.shareDetails')}
            </ShareButton>
            {onSent && (
                <Button variant="secondary" className="w-full" onClick={onSent}>
                    {t('bankDetails.sentTransfer')}
                </Button>
            )}
            {/* money goes to the provider from this screen, so it stays named outside the fold (Resolution 520) */}
            <ProviderFinePrint providerId={providerId} />
        </div>
    )
}

export default MantecaDepositShareDetails
