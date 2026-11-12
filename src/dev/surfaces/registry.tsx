'use client'

import { SetupCelebrationView } from '@/components/Setup/Views/Success'
import { TestBuildRibbonView } from '@/components/Global/TestBuildRibbon'
import { API_CONTRACT_STATES } from './api-contract-states'
import AmountInput from '@/components/Global/AmountInput'
import { StandaloneErrorSurface } from './StandaloneErrorSurface'
import { AddressLaunchModal } from '@/features/deposit-accounts/components/AddressLaunchModal'
import { CardResidenceAddressScreen } from '@/features/card/components/CardResidenceAddressScreen'
import { useToast } from '@/components/0_Bruddle/Toast'

/**
 * Every modal, drawer and full-screen surface in the content-taxonomy review,
 * each mounted open so the visual-shot harness can photograph it.
 *
 * A surface is either `render`able — it takes an open/visible prop we can set —
 * or `blocked`: it opens itself from live state (an API answer, a permission
 * result, a stored flag) and there is no prop to force. Those carry a reason
 * instead of a component, so the gallery says why a screen is missing rather
 * than shooting an empty page.
 */

import React, { useState } from 'react'
import { PixQrDeposit } from '@/features/pix/components/PixQrDeposit'
import { PixWithdrawOutcome } from '@/features/pix/components/PixWithdrawOutcome'
import { PixWithdrawForm } from '@/features/pix/components/PixWithdrawForm'
import type { PixDeposit, PixWithdrawDisplay } from '@/services/pix'
import { pixDepositQueryKey } from '@/features/pix/pixDepositCode'
import { useQueryClient } from '@tanstack/react-query'
import { DEMO_PIX_BR_CODE } from '@/constants/demo-data'
import { useLocale, useTranslations } from 'next-intl'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { SetupConfirmationView } from '@/components/Setup/Views/SignTestTransaction'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { SetupNotificationsPrompt } from '@/components/Notifications/SetupNotificationsModal'
import { setupScreenIds, setupSteps } from '@/components/Setup/Setup.consts'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { useSetupStepCopy } from '@/components/Setup/useSetupStepCopy'
import type { ScreenId } from '@/components/Setup/Setup.types'

import { PasskeySetupHelpDrawer } from '@/components/Setup/Views/PasskeySetupHelpDrawer'
import { LoginRecoveryDrawer } from '@/components/Setup/Views/LoginRecoveryDrawer'
import { PasskeyProviderUnsupportedDrawer } from '@/components/Setup/Views/PasskeyProviderUnsupportedDrawer'
import PasskeyInfoDrawer from '@/components/Setup/components/PasskeyInfoDrawer'
import ConfirmInviteModal from '@/components/Global/ConfirmInviteModal'
import EarlyUserDrawer from '@/components/Global/EarlyUserDrawer'
import EasterEggDrawer from '@/components/Global/EasterEggDrawer'
import { GuestVerificationModal } from '@/components/Global/GuestVerificationModal'
import InviteFriendsModal from '@/components/Global/InviteFriendsModal'
import UnsupportedBrowserModal from '@/components/Global/UnsupportedBrowserModal'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import { KycReverificationPendingModal } from '@/components/Kyc/KycReverificationPendingModal'
import { KycVerificationInProgressModal } from '@/components/Kyc/KycVerificationInProgressModal'
import { KycActionRequiredModal } from '@/components/Kyc/modals/KycActionRequiredModal'
import { KycFailedModal } from '@/components/Kyc/modals/KycFailedModal'
import { KycProcessingModal } from '@/components/Kyc/modals/KycProcessingModal'
import { KycRegionRestrictedModal } from '@/components/Kyc/modals/KycRegionRestrictedModal'
import { KycStatusDrawer } from '@/components/Kyc/KycStatusDrawer'
import CancelCardModal from '@/components/Card/CancelCardModal'
import CardLimitEditDrawer from '@/components/Card/CardLimitEditDrawer'
import LockCardModal from '@/components/Card/LockCardModal'
import AppleWalletRow from '@/components/Card/AppleWalletRow'
import GoogleWalletButton from '@/components/Card/GoogleWalletButton'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { BadgeDetailDrawer } from '@/components/Badges/BadgeDetailDrawer'
import { BadgeStatusDrawer } from '@/components/Badges/BadgeStatusDrawer'
import HowToDepositDrawer from '@/components/AddMoney/components/HowToDepositDrawer'
import { OnrampConfirmationModal } from '@/components/AddMoney/components/OnrampConfirmationModal'
import SupportedNetworksDrawer from '@/components/AddMoney/components/SupportedNetworksDrawer'
import ScanToDownloadModal from '@/components/Migration/ScanToDownloadModal'
import OtaUpdateModal from '@/components/Profile/components/OtaUpdateModal'
import ResidenceChangeDrawer from '@/components/Profile/views/ResidenceChangeDrawer'
import BalanceWarningDrawer from '@/components/Global/BalanceWarningDrawer'
import CancelSendLinkDrawer from '@/components/Global/CancelSendLinkDrawer'
import CameraPermissionDrawer from '@/components/Global/QRScanner/CameraPermissionDrawer'
import { SuccessViewDetailsCard } from '@/components/Global/SuccessViewComponents/SuccessViewDetailsCard'
import OfflineScreen from '@/components/Global/OfflineScreen'
import BackendErrorScreen from '@/components/Global/BackendErrorScreen'
import { UnsupportedWebViewScreen } from '@/components/Global/UnsupportedWebViewScreen'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'
import { FAQsPanel } from '@/components/Global/FAQs'
import { BackupFaqDrawers } from '@/components/Profile/BackupFaqDrawers'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { ContributorsDrawer } from '@/features/payments/flows/contribute-pot/components/ContributorsDrawer'
import { personFrom } from '@/lib/person/person'
import MigrationDownloadModal from '@/components/Migration/MigrationDownloadModal'
import ActivationCTAs from '@/components/Home/ActivationCTAs'
import type { OnboardingState } from '@/utils/activation-step.utils'
import NoMoreJailDrawer from '@/components/Global/NoMoreJailDrawer'
import SendLinkActionList from '@/components/Claim/Link/SendLinkActionList'
import { ClaimErrorView } from '@/components/Claim/Generic/ClaimError.view'
import ApplicationStatusScreen from '@/components/Card/ApplicationStatusScreen'
import ConfirmWithdrawView from '@/features/withdraw/views/ConfirmWithdrawView'
import { WithdrawAmountView } from '@/features/withdraw/views/WithdrawAmountView'
import PublicProfile from '@/components/Profile/components/PublicProfile'
import NotFoundScreen from '@/components/Global/NotFoundScreen'
import { GuestPaymentMethodActionList } from './GuestPaymentMethodActionList'
import { RequestPotActionList } from '@/features/payments/flows/contribute-pot/components/RequestPotActionList'
import RhinoDepositView from '@/components/AddMoney/views/RhinoDeposit.view'
import { RequestCreatedView } from '@/components/Request/link/views/RequestCreatedView'
import { BankTransferChooserDrawer } from '@/features/payments/flows/contribute-pot/components/BankTransferChooserDrawer'
import { MantecaAccountUnavailable } from '@/components/Common/MantecaAccountUnavailable'
import { ResidenceCompare } from '@/components/Setup/components/ResidenceCompare'
import { useResidenceRestrictionSetsWithStatus } from '@/hooks/useResidenceRestrictionSets'
import { buildResidenceCountryOptions } from '@/utils/residence-options'

/**
 * A setup step exactly as /setup renders it — SetupWrapper driven by the step's
 * own entry in Setup.consts, so the hero, clouds, title, back/skip and progress
 * are the app's, not the harness's. Mounting the view bare (which this harness
 * did first) drops all of that and photographs a naked form.
 */
function SetupScreen({
    screenId,
    children,
    showProgress = true,
    forceFullScreen = false,
    residenceCountry,
    nationalityCountry,
}: {
    screenId: ScreenId
    children?: React.ReactNode
    showProgress?: boolean
    forceFullScreen?: boolean
    residenceCountry?: string
    nationalityCountry?: string
}) {
    return (
        <SetupFlowProvider masterScreenIds={setupScreenIds}>
            <SetupScreenBody
                screenId={screenId}
                showProgress={showProgress}
                forceFullScreen={forceFullScreen}
                residenceCountry={residenceCountry}
                nationalityCountry={nationalityCountry}
            >
                {children}
            </SetupScreenBody>
        </SetupFlowProvider>
    )
}
function SetupScreenBody({
    screenId,
    children,
    showProgress = true,
    forceFullScreen = false,
    residenceCountry,
    nationalityCountry,
}: {
    screenId: ScreenId
    children?: React.ReactNode
    showProgress?: boolean
    forceFullScreen?: boolean
    residenceCountry?: string
    nationalityCountry?: string
}) {
    const { setSteps, setResidenceCountry, setNationalityCountry } = useSetupFlowContext()
    React.useLayoutEffect(() => setSteps(setupSteps), [setSteps])
    React.useLayoutEffect(() => {
        if (residenceCountry) setResidenceCountry(residenceCountry)
        if (nationalityCountry) setNationalityCountry(nationalityCountry)
    }, [residenceCountry, setResidenceCountry, nationalityCountry, setNationalityCountry])
    const step = setupSteps.find((entry) => entry.screenId === screenId)
    const stepCopy = useSetupStepCopy(step)
    if (!step) return null
    const View = step.component
    return (
        <SetupWrapper
            fullScreen={forceFullScreen || step.fullScreen}
            showProgress={showProgress}
            layoutType={step.layoutType}
            screenId={step.screenId}
            image={step.image}
            {...stepCopy}
            showBackButton={step.showBackButton}
            showSkipButton={step.showSkipButton}
            imageClassName={step.imageClassName}
            contentClassName={step.contentClassName}
            step={setupSteps.indexOf(step)}
        >
            {children ?? <View />}
        </SetupWrapper>
    )
}

/** verified, funded, card and QR open: the first-payment row opens the chooser */
const FUNDED_CARD_ONBOARDING: OnboardingState = {
    verify: 'done',
    addMoneyDone: true,
    firstPaymentDone: false,
    firstPaymentRoute: 'card_qr',
    step: 'first_payment',
}
const noop = () => {}

/** The final step after repeated network failures: retry copy and the "confirm later" link. */
function NetworkBusyConfirmation() {
    const t = useTranslations('setup')
    const tCommon = useTranslations('common')
    return (
        <SetupConfirmationView
            merged
            onConfirm={noop}
            buttonText={tCommon('tryAgain')}
            error={t('testTransaction.errors.networkBusy')}
            errorDetail={t('testTransaction.finishLaterDescription')}
            secondary={<LinkButton onClick={noop}>{t('testTransaction.finishLater')}</LinkButton>}
        />
    )
}

/** The residence step's comparison, as its Next opens it when the nationality differs. */
function ResidenceCompareSurface({ residence, nationality }: { residence: string; nationality: string }) {
    const locale = useLocale()
    const options = React.useMemo(() => buildResidenceCountryOptions(locale), [locale])
    const { sets } = useResidenceRestrictionSetsWithStatus()
    return (
        <ResidenceCompare
            residence={residence}
            nationality={nationality}
            labelOf={(iso2) => options.find((option) => option.value === iso2)?.label ?? iso2}
            restrictionSets={sets}
            busy={false}
            onChoose={noop}
        />
    )
}
const asyncNoop = async () => {}

/**
 * `/dev/*` deliberately removes AppShell's page padding so the gallery can
 * stage drawers and overlays edge-to-edge. Full app-page surfaces still need
 * the production horizontal frame, otherwise their `w-full` content is
 * captured against the viewport instead of the app's content column.
 */
function AppPageSurface({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-inherit w-full px-4">
            <div data-testid="app-page-surface-content" className="mx-auto min-h-inherit w-full max-w-md">
                {children}
            </div>
        </div>
    )
}

// the deposit card after the pay-request-pot-partial-success fixture's short
// deposit, without its tap and 15 s deposit poll
function RequestPotPartialSurface() {
    const t = useTranslations('payment')
    return (
        <AppPageSurface>
            <RhinoDepositView
                headerTitle={t('headers.pay')}
                chainType="EVM"
                setChainType={noop}
                depositAddressData={{
                    depositAddress: '0xdec0debad1dec0debad1dec0debad1dec0debad1',
                    minDepositLimitUsd: 1,
                    maxDepositLimitUsd: 10000,
                    supportedChains: [],
                }}
                isDepositAddressDataLoading={false}
                onSuccess={noop}
                amount={58.51}
                shortDeposit={{ received: '33', asked: '58.51' }}
                onDone={noop}
            />
        </AppPageSurface>
    )
}

function MantecaAccountUnavailableSurface({ action }: { action: 'deposit' | 'withdraw' }) {
    const tAddMoney = useTranslations('addMoney')
    const tNav = useTranslations('navigation')
    return (
        <AppPageSurface>
            <MantecaAccountUnavailable
                title={action === 'deposit' ? tAddMoney('title') : tNav('withdraw')}
                countryCode={action === 'deposit' ? 'BR' : 'AR'}
                onBack={noop}
                onSupport={noop}
            />
        </AppPageSurface>
    )
}

// the code screen right after POST /pix/deposit, with ten minutes on the clock: the
// create seeds the deposit's query, as the flow does, so no read is needed to draw it
function PixDepositSurface() {
    const queryClient = useQueryClient()
    useState(() =>
        queryClient.setQueryData(pixDepositQueryKey('demo-pix-deposit'), {
            provider: 'avenia',
            intentId: 'demo-pix-deposit',
            status: 'AWAITING_USER_ACTION',
            codePayable: true,
            pixReceived: false,
            brCode: DEMO_PIX_BR_CODE,
            amountBrl: '100.00',
            usdcAmount: '17.940500',
            fixedFeeBrl: '0.75',
            expiresAt: new Date(Date.now() + 9 * 60_000 + 12_000).toISOString(),
            payerCpfMasked: '095.***.***-89',
        } satisfies PixDeposit)
    )
    return (
        <AppPageSurface>
            <PixQrDeposit
                intentId="demo-pix-deposit"
                onBack={noop}
                onDone={noop}
                onNewDeposit={noop}
                onComplete={noop}
            />
        </AppPageSurface>
    )
}

// the withdrawal this session signed, for the last step's in-memory destination
const PIX_SURFACE_DISPLAY: PixWithdrawDisplay = {
    amountBrl: '503.00',
    pixKey: '09579927189',
    ownAccount: true,
    holderName: 'Ana Souza',
    bankName: 'Banco Inter',
    withdrawUsd: '92.504310',
    rate: '5.445692',
    fixedFeeBrl: '0.75',
    arrivalEstimateSeconds: 60,
    provider: 'Avenia',
}

// the last step right after the signature: the destination comes from what was signed. `pastArrival`
// quotes a zero arrival time, so the loader gives way to "on its way" at once, as a slow bank would.
function PixWithdrawOutcomeSurface({
    unnamed = false,
    pastArrival = false,
}: {
    unnamed?: boolean
    pastArrival?: boolean
}) {
    const display = {
        ...PIX_SURFACE_DISPLAY,
        ...(unnamed && { bankName: null, holderName: null }),
        ...(pastArrival && { arrivalEstimateSeconds: 0 }),
    }
    return (
        <AppPageSurface>
            <PixWithdrawOutcome
                title="Withdraw"
                intentId="fixture-pix-withdrawal"
                providerId="avenia-br"
                sent={{ phase: 'funded', display }}
                onStartAgain={noop}
                onDone={noop}
            />
        </AppPageSurface>
    )
}

// the form once Confirm opened the ticket: a moved quote, or one that lapsed before the signature
function PixWithdrawFormSurface({ variant }: { variant: 'quote-moved' | 'after-init' }) {
    const t = useTranslations('pix.withdraw')
    const error =
        variant === 'quote-moved'
            ? { message: t('quoteMoved'), priority: 'attention' as const }
            : { message: `${t('errors.quoteExpired')} ${t('errors.afterInit')}` }
    return (
        <AppPageSurface>
            <PixWithdrawForm
                title="Withdraw"
                onBack={noop}
                recipient={{
                    pixKey: PIX_SURFACE_DISPLAY.pixKey,
                    holderName: PIX_SURFACE_DISPLAY.holderName,
                    bankName: PIX_SURFACE_DISPLAY.bankName,
                    taxIdMasked: null,
                }}
                amount={{
                    seed: { amount: PIX_SURFACE_DISPLAY.amountBrl, denomination: 'BRL' },
                    price: Number(PIX_SURFACE_DISPLAY.amountBrl) / Number(PIX_SURFACE_DISPLAY.withdrawUsd),
                    isLoading: false,
                    isError: false,
                    onRetry: noop,
                    // the opened withdrawal keeps its amount
                    disabled: true,
                    walletBalance: '100',
                    onBrlChange: noop,
                    onUsdChange: noop,
                    onBalanceFilled: noop,
                    onAmountTyped: noop,
                }}
                display={PIX_SURFACE_DISPLAY}
                total="$92.50"
                providerId="avenia-br"
                error={error}
                isSubmitting={false}
                canConfirm={variant === 'quote-moved'}
                onConfirm={noop}
            />
        </AppPageSurface>
    )
}

function WithdrawReviewSurface({
    isProcessing = false,
    alreadySpent = false,
}: {
    isProcessing?: boolean
    alreadySpent?: boolean
}) {
    return (
        <AppPageSurface>
            <ConfirmWithdrawView
                amount="50"
                token={
                    {
                        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                        symbol: 'USDC',
                        decimals: 6,
                    } as React.ComponentProps<typeof ConfirmWithdrawView>['token']
                }
                chain={
                    { chainId: 'solana', networkName: 'Solana' } as React.ComponentProps<
                        typeof ConfirmWithdrawView
                    >['chain']
                }
                toAddress="11111111111111111111111111111111"
                onConfirm={noop}
                onBack={noop}
                insufficientBalance
                isProcessing={isProcessing}
                alreadySpent={alreadySpent}
            />
        </AppPageSurface>
    )
}

function CardInformationSurface({
    actions,
    failed = false,
}: {
    actions: Array<'provideTaxId' | 'provideBirthDate'>
    failed?: boolean
}) {
    const t = useTranslations('card')
    return (
        <AppPageSurface>
            <ApplicationStatusScreen
                variant="requires-info"
                informationActions={actions.map((key) => ({
                    key,
                    kind: key === 'provideTaxId' ? 'taxId' : 'birthDate',
                    label: t(key),
                    onClick: noop,
                }))}
                uploadError={failed ? t('informationStartFailed') : undefined}
                onContactSupport={noop}
                onPrev={noop}
            />
        </AppPageSurface>
    )
}

function WithdrawAmountErrorSurface() {
    const t = useTranslations('withdraw')
    const tNav = useTranslations('navigation')
    return (
        <AppPageSurface>
            <WithdrawAmountView
                pageTitle={tNav('withdraw')}
                heading={t('amountToWithdraw')}
                initialAmount="0.01"
                walletBalance="50.00"
                balanceFillAmount={50}
                onBalanceFilled={noop}
                onAmountChange={noop}
                onBack={noop}
                onContinue={noop}
                continueDisabled
                error={{ showError: true, errorMessage: t('errors.minWithdrawAmount', { amount: 2 }) }}
                isCryptoWithdraw={false}
            />
        </AppPageSurface>
    )
}

import { AvatarPicker } from '@/components/Avatar/AvatarPicker'
import ProvideEmailStep from '@/components/Kyc/ProvideEmailStep'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import KycPrepChecklist from '@/components/Kyc/KycPrepChecklist'
import { RejectLabelsList } from '@/components/Kyc/RejectLabelsList'
import { KycActionRequired } from '@/components/Kyc/states/KycActionRequired'
import RateUnavailable from '@/components/Global/RateUnavailable'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { SURFACE_META, type SurfaceMeta } from './list'
import { PasskeyHelpA, PasskeyHelpB, PasskeyHelpC, PasskeyHelpD } from './options/PasskeyHelpOptions'

export type Surface = SurfaceMeta & {
    /** Mounted open. Absent when `blocked` explains why it cannot be. */
    render?: () => React.ReactNode
    /** Opened by flipping a ModalsContext flag rather than a prop. */
    modalsContextFlag?: 'signIn' | 'support' | 'qrScanner'
}

function AddressLaunchSurface({ bank, loading }: { bank: boolean; loading: boolean }) {
    const tBank = useTranslations('depositAccounts')
    const tKyc = useTranslations('kyc')
    return bank ? (
        <AddressLaunchModal
            visible
            loading={loading}
            error={loading ? null : tBank('gate.actFailed')}
            terminal={false}
            onClose={noop}
            onRetry={noop}
            onContactSupport={noop}
        />
    ) : (
        <AppPageSurface>
            <CardResidenceAddressScreen
                state="required"
                loading={loading}
                error={loading ? null : tKyc('errorStartActionFailed')}
                onBack={noop}
                onStart={noop}
                onRefresh={noop}
            />
        </AppPageSurface>
    )
}

function DepositAddressSubmittedToastSurface() {
    const t = useTranslations('depositAccounts.gate')
    const { info, dismiss } = useToast()
    const message = t('addressSent')
    React.useEffect(() => {
        const id = info(message, { duration: 'persistent' })
        return () => dismiss(id)
    }, [message, info, dismiss])
    return null
}

export const SURFACES: Record<string, Surface> = {
    'deposit-address-launch-loading': {
        ...SURFACE_META['deposit-address-launch-loading'],
        render: () => <AddressLaunchSurface bank loading />,
    },
    'deposit-address-launch-error': {
        ...SURFACE_META['deposit-address-launch-error'],
        render: () => <AddressLaunchSurface bank loading={false} />,
    },
    'deposit-address-submitted-toast': {
        ...SURFACE_META['deposit-address-submitted-toast'],
        render: () => <DepositAddressSubmittedToastSurface />,
    },
    'card-address-launch-loading': {
        ...SURFACE_META['card-address-launch-loading'],
        render: () => <AddressLaunchSurface bank={false} loading />,
    },
    'card-address-launch-error': {
        ...SURFACE_META['card-address-launch-error'],
        render: () => <AddressLaunchSurface bank={false} loading={false} />,
    },
    'card-address-unavailable': {
        ...SURFACE_META['card-address-unavailable'],
        render: () => (
            <AppPageSurface>
                <CardResidenceAddressScreen
                    state="unavailable"
                    loading={false}
                    onBack={noop}
                    onStart={noop}
                    onRefresh={noop}
                />
            </AppPageSurface>
        ),
    },
    'standalone-error-card': {
        ...SURFACE_META['standalone-error-card'],
        render: () => (
            <AppPageSurface>
                <StandaloneErrorSurface kind="card" />
            </AppPageSurface>
        ),
    },
    'standalone-error-card-recovery': {
        ...SURFACE_META['standalone-error-card-recovery'],
        render: () => (
            <AppPageSurface>
                <StandaloneErrorSurface kind="card-recovery" />
            </AppPageSurface>
        ),
    },
    'standalone-error-claim': {
        ...SURFACE_META['standalone-error-claim'],
        render: () => (
            <AppPageSurface>
                <StandaloneErrorSurface kind="claim" />
            </AppPageSurface>
        ),
    },
    'standalone-error-send': {
        ...SURFACE_META['standalone-error-send'],
        render: () => (
            <AppPageSurface>
                <StandaloneErrorSurface kind="send" />
            </AppPageSurface>
        ),
    },
    'standalone-error-withdraw': {
        ...SURFACE_META['standalone-error-withdraw'],
        render: () => (
            <AppPageSurface>
                <StandaloneErrorSurface kind="withdraw" />
            </AppPageSurface>
        ),
    },
    'standalone-error-wallet-recovery': {
        ...SURFACE_META['standalone-error-wallet-recovery'],
        render: () => <StandaloneErrorSurface kind="wallet-recovery" />,
    },
    ...Object.fromEntries(
        Object.entries(API_CONTRACT_STATES).map(([id, state]) => [
            id,
            {
                ...SURFACE_META[id],
                render: () => <TestBuildRibbonView branch="test/kyc-contract" api={state.api} />,
            },
        ])
    ),
    'numeric-request-amount-4000': {
        ...SURFACE_META['numeric-request-amount-4000'],
        render: () => (
            <AppPageSurface>
                <AmountInput setPrimaryAmount={noop} showSlider maxAmount={4000} defaultSliderSuggestedAmount={4000} />
            </AppPageSurface>
        ),
    },
    'numeric-request-rate-unavailable': {
        ...SURFACE_META['numeric-request-rate-unavailable'],
        render: () => (
            <AppPageSurface>
                <AmountInput
                    initialAmount="4000"
                    setPrimaryAmount={noop}
                    primaryDenomination={{ symbol: 'USDC', price: 1, decimals: 6 }}
                    secondaryDenomination={{ symbol: 'EUR', price: 0, decimals: 2 }}
                />
            </AppPageSurface>
        ),
    },
    'numeric-request-amount-invalid': {
        ...SURFACE_META['numeric-request-amount-invalid'],
        render: () => (
            <AppPageSurface>
                <AmountInput initialAmount="Infinity" setPrimaryAmount={noop} showSlider maxAmount={4000} />
            </AppPageSurface>
        ),
    },
    '01-a-landing': {
        ...SURFACE_META['01-a-landing'],
        render: () => <SetupScreen screenId="landing" />,
    },

    '03-c-residence-congrats': {
        ...SURFACE_META['03-c-residence-congrats'],
        render: () => <SetupScreen screenId="payment-plan" residenceCountry="PT" />,
    },
    '03-h-funding-methods': {
        ...SURFACE_META['03-h-funding-methods'],
        render: () => <SetupScreen screenId="payment-plan" residenceCountry="BR" />,
    },
    '03-i-payment-methods': {
        ...SURFACE_META['03-i-payment-methods'],
        render: () => <SetupScreen screenId="payment-plan" residenceCountry="BR" />,
    },
    '03-a-residence-select': {
        ...SURFACE_META['03-a-residence-select'],
        render: () => <SetupScreen screenId="residence" />,
    },
    '03-b-residence-compare': {
        ...SURFACE_META['03-b-residence-compare'],
        render: () => (
            <SetupScreen screenId="residence" residenceCountry="PT" nationalityCountry="BR">
                <ResidenceCompareSurface residence="PT" nationality="BR" />
            </SetupScreen>
        ),
    },

    '05-a-signtesttransaction': {
        ...SURFACE_META['05-a-signtesttransaction'],
        render: () => (
            <SetupScreen screenId="advantage-control">
                <SetupConfirmationView merged onConfirm={noop} />
            </SetupScreen>
        ),
    },
    '05-b-signtesttransaction-network-busy': {
        ...SURFACE_META['05-b-signtesttransaction-network-busy'],
        render: () => (
            <SetupScreen screenId="advantage-control">
                <NetworkBusyConfirmation />
            </SetupScreen>
        ),
    },
    '06-b-invite': {
        ...SURFACE_META['06-b-invite'],
        render: () => <SetupScreen screenId="invite" />,
    },
    '06-a-signup': { name: 'Signup', path: 'Setup/Views/Signup.tsx', render: () => <SetupScreen screenId="signup" /> },
    '02-b-advantage-card': {
        ...SURFACE_META['02-b-advantage-card'],
        render: () => <SetupScreen screenId="advantage-card" />,
    },

    '04-b-advantage-fees': {
        ...SURFACE_META['04-b-advantage-fees'],
        render: () => <SetupScreen screenId="advantage-fees" />,
    },
    '07-c-notification-email': {
        ...SURFACE_META['07-c-notification-email'],
        render: () => <SetupScreen screenId="notification-email" />,
    },
    '07-d-notification-settings': {
        ...SURFACE_META['07-d-notification-settings'],
        render: () => <SetupScreen screenId="notification-permission" />,
    },
    '07-e-setup-celebration': {
        ...SURFACE_META['07-e-setup-celebration'],
        render: () => (
            <SetupScreen screenId="advantage-control" showProgress={false} forceFullScreen>
                <SetupCelebrationView />
            </SetupScreen>
        ),
    },
    '07-b-advantage-control': {
        ...SURFACE_META['07-b-advantage-control'],
        render: () => (
            <SetupScreen screenId="advantage-control">
                <SetupConfirmationView merged onConfirm={noop} />
            </SetupScreen>
        ),
    },
    '08-a-passkeysetuphelpmodal': {
        ...SURFACE_META['08-a-passkeysetuphelpmodal'],
        render: () => (
            <PasskeySetupHelpDrawer
                visible
                onClose={noop}
                onRetry={noop}
                errorName="NotAllowedError"
                platform="android"
            />
        ),
    },
    '08-b-loginrecoverydrawer': {
        ...SURFACE_META['08-b-loginrecoverydrawer'],
        render: () => (
            <LoginRecoveryDrawer
                visible
                onClose={noop}
                onRetry={noop}
                onSignUp={noop}
                onSupport={noop}
                platform="ios"
            />
        ),
    },
    '08-c-loginrecoverydrawer-web': {
        ...SURFACE_META['08-c-loginrecoverydrawer-web'],
        render: () => <LoginRecoveryDrawer visible onClose={noop} onRetry={noop} onSupport={noop} platform="web" />,
    },
    '08-d-passkeyproviderunsupporteddrawer': {
        ...SURFACE_META['08-d-passkeyproviderunsupporteddrawer'],
        render: () => (
            <PasskeyProviderUnsupportedDrawer
                visible
                platform="android-app"
                onClose={noop}
                onRetry={noop}
                onSignUpInBrowser={noop}
                onSupport={noop}
            />
        ),
    },
    '08-e-passkeyproviderunsupporteddrawer-browser-failed': {
        ...SURFACE_META['08-e-passkeyproviderunsupporteddrawer-browser-failed'],
        render: () => (
            <PasskeyProviderUnsupportedDrawer
                visible
                platform="android-app"
                browserOpenFailed
                onClose={noop}
                onRetry={noop}
                onSignUpInBrowser={noop}
                onSupport={noop}
            />
        ),
    },
    '08-f-passkeyproviderunsupporteddrawer-other': {
        ...SURFACE_META['08-f-passkeyproviderunsupporteddrawer-other'],
        render: () => (
            <PasskeyProviderUnsupportedDrawer
                visible
                platform="other"
                onClose={noop}
                onRetry={noop}
                onSignUpInBrowser={noop}
                onSupport={noop}
            />
        ),
    },
    '09-a-passkeyinfomodal': {
        name: 'PasskeyInfoDrawer',
        path: 'Setup/components/PasskeyInfoDrawer.tsx',
        render: () => <PasskeyInfoDrawer visible onClose={noop} />,
    },
    '10-a-confirminvitemodal': {
        ...SURFACE_META['10-a-confirminvitemodal'],
        render: () => (
            <ConfirmInviteModal
                isOpen
                onClose={noop}
                username="maria"
                handleLoseInvite={noop}
                handleContinueWithPeanut={noop}
            />
        ),
    },
    '11-a-earlyusermodal': {
        // self-opens off user.showEarlyUserModal — the early-user fixture stubs it true
        name: 'EarlyUserDrawer',
        path: 'Global/EarlyUserDrawer/index.tsx',
        shotFixture: 'early-user',
        render: () => (
            <EarlyUserDrawer
                presentation="drawer"
                askId="early-user"
                onActed={noop}
                onDismissed={noop}
                onSnoozed={noop}
            />
        ),
    },
    '12-a-eastereggmodal': {
        name: 'EasterEggDrawer',
        path: 'Global/EasterEggDrawer/index.tsx',
        render: () => <EasterEggDrawer visible onClose={noop} countryCode="AQ" />,
    },
    '13-a-guestloginmodal': {
        ...SURFACE_META['13-a-guestloginmodal'],
        modalsContextFlag: 'signIn',
    },
    '14-a-guestverificationmodal': {
        ...SURFACE_META['14-a-guestverificationmodal'],
        render: () => (
            <GuestVerificationModal
                isOpen
                onClose={noop}
                description="The sender can't send to a bank yet. Claim another way, or create and verify an account to receive it in your bank."
                secondaryCtaLabel="Claim with other method"
            />
        ),
    },
    '15-a-invitefriendsmodal': {
        name: 'InviteFriendsModal',
        path: 'Global/InviteFriendsModal/index.tsx',
        render: () => <InviteFriendsModal visible onClose={noop} username="demo" />,
    },
    '17-a-nomorejailmodal': {
        ...SURFACE_META['17-a-nomorejailmodal'],
        // opens off sessionStorage showNoMoreJailModal, which the spec seeds
        render: () => <NoMoreJailDrawer />,
    },
    '18-a-reconsentmodal': {
        ...SURFACE_META['18-a-reconsentmodal'],
    },
    '19-a-unsupportedbrowsermodal': {
        ...SURFACE_META['19-a-unsupportedbrowsermodal'],
        render: () => <UnsupportedBrowserModal visible allowClose />,
    },
    '20-a-setupnotificationsmodal': {
        ...SURFACE_META['20-a-setupnotificationsmodal'],
        render: () => <SetupNotificationsPrompt visible onAllow={noop} onClose={noop} />,
    },
    '22-b-initiatekycmodal': {
        ...SURFACE_META['22-b-initiatekycmodal'],
        render: () => <InitiateKycModal visible onClose={noop} onVerify={noop} />,
    },
    '23-b-kycreverificationpendingmodal': {
        ...SURFACE_META['23-b-kycreverificationpendingmodal'],
        render: () => <KycReverificationPendingModal isOpen onClose={noop} />,
    },
    '24-b-kycverificationinprogressmodal': {
        ...SURFACE_META['24-b-kycverificationinprogressmodal'],
        render: () => <KycVerificationInProgressModal isOpen onClose={noop} />,
    },
    '24-c-kyctaxidsubmitted': {
        ...SURFACE_META['24-c-kyctaxidsubmitted'],
        render: () => <KycVerificationInProgressModal isOpen onClose={noop} phase="submitted" />,
    },
    '24-c-kyc-ready-ars-action': {
        ...SURFACE_META['24-c-kyc-ready-ars-action'],
        render: () => (
            <KycVerificationInProgressModal
                isOpen
                onClose={noop}
                phase="complete"
                completionNotice={{ kind: 'action', currencies: ['ARS'] }}
            />
        ),
    },
    '24-d-kyc-ready-bank-review': {
        ...SURFACE_META['24-d-kyc-ready-bank-review'],
        render: () => (
            <KycVerificationInProgressModal
                isOpen
                onClose={noop}
                phase="complete"
                completionNotice={{ kind: 'review', currencies: ['EUR'] }}
            />
        ),
    },
    '25-b-kycactionrequiredmodal': {
        ...SURFACE_META['25-b-kycactionrequiredmodal'],
        render: () => (
            <KycActionRequiredModal
                visible
                onClose={noop}
                onResubmit={noop}
                rejectLabels={['PROBLEMATIC_APPLICANT_DATA']}
            />
        ),
    },
    '26-b-kycfailedmodal': {
        ...SURFACE_META['26-b-kycfailedmodal'],
        render: () => <KycFailedModal visible onClose={noop} onRetry={noop} rejectType="RETRY" />,
    },
    '27-b-kycprocessingmodal': {
        ...SURFACE_META['27-b-kycprocessingmodal'],
        render: () => <KycProcessingModal visible onClose={noop} />,
    },
    '28-b-kycregionrestrictedmodal': {
        ...SURFACE_META['28-b-kycregionrestrictedmodal'],
        render: () => <KycRegionRestrictedModal visible onClose={noop} />,
    },
    '29-b-kycstatusdrawer': {
        ...SURFACE_META['29-b-kycstatusdrawer'],
        render: () => <KycStatusDrawer isOpen onClose={noop} />,
    },
    '32-c-cancelcardmodal': {
        ...SURFACE_META['32-c-cancelcardmodal'],
        render: () => <CancelCardModal cardId="demo-card" isOpen onClose={noop} />,
    },
    '33-c-cardlimiteditmodal': {
        ...SURFACE_META['33-c-cardlimiteditmodal'],
        render: () => (
            // perauthorization is the only frequency the product surfaces
            <CardLimitEditDrawer
                cardId="demo-card"
                frequency="perAuthorization"
                label="Per transaction"
                initialAmountCents={50000}
                isOpen
                onClose={noop}
            />
        ),
    },
    '34-c-lockcardmodal': {
        ...SURFACE_META['34-c-lockcardmodal'],
        render: () => <LockCardModal cardId="demo-card" mode="lock" isOpen onClose={noop} />,
    },
    '35-c-googlewalletbutton': {
        ...SURFACE_META['35-c-googlewalletbutton'],
        render: () => (
            <AppPageSurface>
                <div className="flex flex-col gap-6">
                    <TitleBlock title="Add to Google Wallet" />
                    <GoogleWalletButton isAdding={false} onClick={noop} />
                </div>
            </AppPageSurface>
        ),
    },
    '35-c-googlewalletbutton-adding': {
        ...SURFACE_META['35-c-googlewalletbutton-adding'],
        render: () => (
            <AppPageSurface>
                <div className="flex flex-col gap-6">
                    <TitleBlock title="Add to Google Wallet" />
                    <GoogleWalletButton isAdding onClick={noop} />
                </div>
            </AppPageSurface>
        ),
    },
    '35-c-applewalletrow': {
        ...SURFACE_META['35-c-applewalletrow'],
        render: () => (
            <AppPageSurface>
                <div className="flex flex-col gap-6">
                    <TitleBlock title="Add to Apple Wallet" />
                    <AppleWalletRow isAdding={false} onClick={noop} />
                </div>
            </AppPageSurface>
        ),
    },
    '35-c-applewalletrow-adding': {
        ...SURFACE_META['35-c-applewalletrow-adding'],
        render: () => (
            <AppPageSurface>
                <div className="flex flex-col gap-6">
                    <TitleBlock title="Add to Apple Wallet" />
                    <AppleWalletRow isAdding onClick={noop} />
                </div>
            </AppPageSurface>
        ),
    },
    '36-c-badgedetailmodal': {
        ...SURFACE_META['36-c-badgedetailmodal'],
        render: () => (
            // a real badge with avatar art, so the gallery shows the
            // "What you get" box
            <BadgeDetailDrawer
                isOpen
                onClose={noop}
                code="BETA_TESTER"
                title="Beta Tester"
                description="You broke things so others don't have to."
                logo="/badges/beta_tester.svg"
            />
        ),
    },
    '37-c-badgestatusdrawer': {
        ...SURFACE_META['37-c-badgestatusdrawer'],
        render: () => (
            <BadgeStatusDrawer
                isOpen
                onClose={noop}
                badge={{
                    code: 'first-invite',
                    name: 'First Invite',
                    description: 'You invited your first friend to Peanut.',
                    iconUrl: '/badges/first-invite.webp',
                    earnedAt: '2026-08-01T10:00:00.000Z',
                }}
            />
        ),
    },
    '38-c-howtodepositmodal': {
        name: 'HowToDepositDrawer',
        path: 'AddMoney/components/HowToDepositDrawer.tsx',
        render: () => <HowToDepositDrawer visible onClose={noop} />,
    },
    '39-c-onrampconfirmationmodal': {
        ...SURFACE_META['39-c-onrampconfirmationmodal'],
        render: () => <OnrampConfirmationModal visible onClose={noop} onConfirm={noop} />,
    },
    '40-c-supportednetworksmodal': {
        name: 'SupportedNetworksDrawer',
        path: 'AddMoney/components/SupportedNetworksDrawer.tsx',
        render: () => <SupportedNetworksDrawer visible onClose={noop} />,
    },
    '41-c-migrationdownloadmodal': {
        name: 'MigrationDownloadModal',
        path: 'Migration/MigrationDownloadModal.tsx',
        render: () => (
            <MigrationDownloadModal
                presentation="modal"
                askId="install-app"
                onActed={noop}
                onDismissed={noop}
                onSnoozed={noop}
            />
        ),
    },
    '43-c-scantodownloadmodal': {
        ...SURFACE_META['43-c-scantodownloadmodal'],
        render: () => <ScanToDownloadModal visible onClose={noop} surface="home_banner" />,
    },
    '44-c-otaupdatemodal': {
        ...SURFACE_META['44-c-otaupdatemodal'],
        render: () => <OtaUpdateModal visible onClose={noop} />,
    },
    '45-c-residencechangemodal': {
        ...SURFACE_META['45-c-residencechangemodal'],
        render: () => (
            <ResidenceChangeDrawer
                visible
                onClose={noop}
                userId="demo-user"
                declared="ESP"
                verified="ESP"
                onSaved={asyncNoop}
                onReverify={noop}
            />
        ),
    },
    '48-c-balancewarningmodal': {
        name: 'BalanceWarningDrawer',
        path: 'Global/BalanceWarningDrawer/index.tsx',
        render: () => <BalanceWarningDrawer visible onCloseAction={noop} />,
    },
    '50-d-transactiondetailsdrawer': {
        ...SURFACE_META['50-d-transactiondetailsdrawer'],
        render: () => (
            <TransactionDetailsDrawer
                isOpen
                onClose={noop}
                transaction={
                    {
                        id: 'demo-tx',
                        direction: 'OUTGOING',
                        userName: 'ana',
                        fullName: 'Ana Ruiz',
                        amount: 25,
                        initials: 'AR',
                        status: 'completed',
                        date: '2026-08-01T10:00:00.000Z',
                        memo: 'Dinner',
                    } as never
                }
                transactionAmount="$25.00"
            />
        ),
    },
    '51-d-homeactiondrawers': {
        ...SURFACE_META['51-d-homeactiondrawers'],
    },
    '52-d-contributorsdrawer': {
        ...SURFACE_META['52-d-contributorsdrawer'],
        render: () => (
            <ContributorsDrawer
                contributors={[
                    {
                        uuid: 'c1',
                        username: 'ana',
                        person: personFrom({ username: 'ana', avatarKey: 'basic.star' }),
                        amount: '25.00',
                        createdAt: '2026-08-01T10:00:00.000Z',
                    },
                    // no pick — the username letter beside someone who has one
                    {
                        uuid: 'c2',
                        username: 'bruno',
                        person: personFrom({ username: 'bruno' }),
                        amount: '10.00',
                        createdAt: '2026-08-01T11:00:00.000Z',
                    },
                ]}
            />
        ),
    },
    '53-d-cancelsendlinkdrawer': {
        ...SURFACE_META['53-d-cancelsendlinkdrawer'],
        render: () => (
            <CancelSendLinkDrawer showCancelLinkDrawer setShowCancelLinkDrawer={noop} amount="$25.00" onClick={noop} />
        ),
    },
    '54-d-qrbottomdrawer': {
        ...SURFACE_META['54-d-qrbottomdrawer'],
        modalsContextFlag: 'qrScanner',
    },
    '55-d-supportdrawer': {
        ...SURFACE_META['55-d-supportdrawer'],
        modalsContextFlag: 'support',
    },
    '56-d-camerapermissionmodal': {
        name: 'CameraPermissionDrawer',
        path: 'Global/QRScanner/CameraPermissionDrawer.tsx',
        render: () => <CameraPermissionDrawer visible onRetry={noop} onClose={noop} />,
    },
    '57-d-raincooldownintromodal': {
        ...SURFACE_META['57-d-raincooldownintromodal'],
    },
    '58-d-stalecardapprovalreenablemodal': {
        ...SURFACE_META['58-d-stalecardapprovalreenablemodal'],
    },
    '59-d-successviewdetailscard': {
        ...SURFACE_META['59-d-successviewdetailscard'],
        render: () => (
            <div className="p-4">
                <SuccessViewDetailsCard title="Sent to @ana" amountDisplay="25.00" description="Arrives in minutes" />
            </div>
        ),
    },
    '60-d-offlinescreen': {
        ...SURFACE_META['60-d-offlinescreen'],
        render: () => <OfflineScreen />,
    },
    '61-d-backenderrorscreen': {
        ...SURFACE_META['61-d-backenderrorscreen'],
        render: () => <BackendErrorScreen />,
    },
    '62-d-unsupportedwebviewscreen': {
        ...SURFACE_META['62-d-unsupportedwebviewscreen'],
        render: () => <UnsupportedWebViewScreen />,
    },
    '63-d-emptystate': {
        ...SURFACE_META['63-d-emptystate'],
        render: () => (
            <div className="p-4">
                <EmptyState icon="search" title="Nothing here yet" description="Payments you make will show up here." />
            </div>
        ),
    },
    '64-d-nodataemptystate': {
        ...SURFACE_META['64-d-nodataemptystate'],
        render: () => (
            <div className="p-4">
                <NoDataEmptyState message="No transactions yet" />
            </div>
        ),
    },
    '65-d-faqs': {
        ...SURFACE_META['65-d-faqs'],
        render: () => (
            <div className="p-4">
                <FAQsPanel
                    heading="FAQ."
                    questions={[
                        { id: 'q1', question: 'How long does a transfer take?', answer: 'Usually a few minutes.' },
                        { id: 'q2', question: 'What does it cost?', answer: 'No fee on Peanut to Peanut.' },
                    ]}
                />
            </div>
        ),
    },
    '66-e-avatarpicker': {
        ...SURFACE_META['66-e-avatarpicker'],
        render: () => (
            <div className="p-4">
                <AvatarPicker open onOpenChange={noop} />
            </div>
        ),
    },
    '67-e-provideemailstep': {
        ...SURFACE_META['67-e-provideemailstep'],
        render: () => (
            <div className="p-4">
                <ProvideEmailStep visible onComplete={noop} onSkip={noop} />
            </div>
        ),
    },
    '68-e-bridgetosstep': {
        ...SURFACE_META['68-e-bridgetosstep'],
        render: () => (
            <div className="p-4">
                <BridgeTosStep visible onComplete={noop} onSkip={noop} />
            </div>
        ),
    },
    '71-e-kycprepchecklist-hosted': {
        ...SURFACE_META['71-e-kycprepchecklist-hosted'],
        render: () => (
            <div className="p-4">
                <KycPrepChecklist />
            </div>
        ),
    },
    '72-e-kycfailedcontent-terminal': {
        ...SURFACE_META['72-e-kycfailedcontent-terminal'],
        render: () => <KycFailedModal visible onClose={noop} onRetry={noop} isTerminal />,
    },
    '73-e-rejectlabelslist': {
        ...SURFACE_META['73-e-rejectlabelslist'],
        render: () => (
            <div className="p-4">
                <RejectLabelsList rejectLabels={['DOCUMENT_DAMAGED', 'UNSATISFACTORY_PHOTOS']} />
            </div>
        ),
    },
    '74-e-kycactionrequired': {
        ...SURFACE_META['74-e-kycactionrequired'],
        render: () => (
            <div className="p-4">
                <KycActionRequired onResume={noop} rejectLabels={['UNSATISFACTORY_PHOTOS']} />
            </div>
        ),
    },
    '75-e-rateunavailable': {
        ...SURFACE_META['75-e-rateunavailable'],
        render: () => (
            <div className="p-4">
                <RateUnavailable onRetry={noop} />
            </div>
        ),
    },
    '76-e-limitswarningcard-warning': {
        ...SURFACE_META['76-e-limitswarningcard-warning'],
        render: () => (
            <div className="p-4">
                <LimitsWarningCard
                    type="attention"
                    titleKind="attention"
                    title="Transaction limit"
                    items={[{ text: 'You can pay up to $500 today.' }]}
                />
            </div>
        ),
    },
    '77-e-limitswarningcard-error': {
        ...SURFACE_META['77-e-limitswarningcard-error'],
        render: () => (
            <div className="p-4">
                <LimitsWarningCard
                    type="error"
                    titleKind="blocking"
                    title="Transaction limit"
                    items={[{ text: 'You can pay up to $500 today.' }]}
                />
            </div>
        ),
    },
    '78-f-choice-guest-claim': {
        ...SURFACE_META['78-f-choice-guest-claim'],
        render: () => (
            <div className="flex min-h-dvh w-full flex-col justify-center gap-4 p-4">
                <SendLinkActionList
                    claimLinkData={
                        {
                            pubKey: 'demo-pubkey',
                            depositIdx: 0,
                            chainId: '42161',
                            contractVersion: 'v4.3',
                            status: 'CREATED',
                            createdAt: '2026-09-01T12:00:00.000Z',
                            senderAddress: '0x1111111111111111111111111111111111111111',
                            amount: BigInt(25_000_000),
                            tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                            tokenDecimals: 6,
                            tokenSymbol: 'USDC',
                            sender: {
                                userId: 'demo-ana',
                                username: 'ana',
                                fullName: 'Ana Ruiz',
                                bridgeKycStatus: 'approved',
                                accounts: [],
                            },
                            link: 'https://peanut.me/claim?c=42161&v=v4.3&i=0#p=demo',
                            password: 'demo',
                        } as never
                    }
                    isLoggedIn={false}
                />
            </div>
        ),
    },
    '79-f-choice-direct-send': {
        ...SURFACE_META['79-f-choice-direct-send'],
        render: () => (
            <div className="flex min-h-dvh w-full flex-col justify-center p-4">
                <GuestPaymentMethodActionList isAmountEntered />
            </div>
        ),
    },
    '80-f-choice-semantic-request': {
        ...SURFACE_META['80-f-choice-semantic-request'],
        render: () => (
            <div className="flex min-h-dvh w-full flex-col justify-center p-4">
                <GuestPaymentMethodActionList isAmountEntered onPayWithExternalWallet={noop} />
            </div>
        ),
    },
    '81-f-choice-request-pot': {
        ...SURFACE_META['81-f-choice-request-pot'],
        render: () => (
            <div className="flex min-h-dvh w-full flex-col justify-center p-4">
                <RequestPotActionList
                    isAmountEntered
                    usdAmount="25"
                    recipientUserId="demo-ana"
                    person={personFrom({ username: 'ana' })}
                    onPayWithPeanut={noop}
                    onPayWithExternalWallet={noop}
                />
            </div>
        ),
    },
    '81-g-request-pot-partial': {
        ...SURFACE_META['81-g-request-pot-partial'],
        render: () => <RequestPotPartialSurface />,
    },
    '82-f-choice-card-requires-info': {
        ...SURFACE_META['82-f-choice-card-requires-info'],
        render: () => (
            <AppPageSurface>
                <ApplicationStatusScreen
                    variant="requires-info"
                    onUploadProofOfAddress={noop}
                    onUploadIdentity={noop}
                    onContactSupport={noop}
                />
            </AppPageSurface>
        ),
    },
    '82-f-choice-card-needs-review': {
        ...SURFACE_META['82-f-choice-card-needs-review'],
        render: () => (
            <AppPageSurface>
                <ApplicationStatusScreen
                    variant="requires-info"
                    reasonCode="card_needs_review"
                    onUploadProofOfAddress={noop}
                    onUploadIdentity={noop}
                    onContactSupport={noop}
                />
            </AppPageSurface>
        ),
    },
    '82-g-card-tax-id': {
        ...SURFACE_META['82-g-card-tax-id'],
        render: () => <CardInformationSurface actions={['provideTaxId']} />,
    },
    '82-h-card-birth-date': {
        ...SURFACE_META['82-h-card-birth-date'],
        render: () => <CardInformationSurface actions={['provideBirthDate']} />,
    },
    '82-i-card-information-both': {
        ...SURFACE_META['82-i-card-information-both'],
        render: () => <CardInformationSurface actions={['provideTaxId', 'provideBirthDate']} />,
    },
    '82-j-card-information-error': {
        ...SURFACE_META['82-j-card-information-error'],
        render: () => <CardInformationSurface actions={['provideTaxId']} failed />,
    },
    '92-f-withdraw-amount-error': {
        ...SURFACE_META['92-f-withdraw-amount-error'],
        render: () => <WithdrawAmountErrorSurface />,
    },
    '83-f-choice-residence-restricted': {
        ...SURFACE_META['83-f-choice-residence-restricted'],
        render: () => <SetupScreen screenId="payment-plan" residenceCountry="RU" />,
    },
    '84-f-choice-public-profile-guest': {
        ...SURFACE_META['84-f-choice-public-profile-guest'],
        render: () => (
            <AppPageSurface>
                <PublicProfile username="alice" isLoggedIn={false} onSendClick={noop} />
            </AppPageSurface>
        ),
    },
    '85-f-choice-claim-error': {
        ...SURFACE_META['85-f-choice-claim-error'],
        render: () => (
            <div className="flex min-h-dvh w-full flex-col justify-center p-4">
                <ClaimErrorView
                    title="We couldn't complete the claim"
                    message="The transfer is still safe. Try again or ask support for help."
                    primaryButtonText="Try again"
                    onPrimaryClick={noop}
                />
            </div>
        ),
    },
    '86-f-choice-not-found': {
        ...SURFACE_META['86-f-choice-not-found'],
        render: () => <NotFoundScreen />,
    },
    '87-f-request-created': {
        ...SURFACE_META['87-f-request-created'],
        render: () => (
            <AppPageSurface>
                <RequestCreatedView
                    requestId="fixture-request"
                    generatedLink="https://peanut.me/request/pay?id=fixture-request"
                    requestAmount="25"
                    currency="EUR"
                    bankPayable={false}
                    onDone={noop}
                />
            </AppPageSurface>
        ),
    },
    '88-f-request-bank-currency': {
        ...SURFACE_META['88-f-request-bank-currency'],
        render: () => (
            <div className="flex min-h-dvh w-full flex-col justify-center p-4">
                <BankTransferChooserDrawer
                    requestId="fixture-request"
                    rails={[
                        {
                            kind: 'bank',
                            railId: 'bridge.sepa_eu',
                            reference: 'PEANUT-1234',
                            payerAmount: { amount: '25.00', currency: 'EUR', isEstimate: false },
                        },
                        {
                            kind: 'bank',
                            railId: 'bridge.faster_payments_gb',
                            reference: 'PEANUT-1234',
                            payerAmount: { amount: '21.50', currency: 'GBP', isEstimate: true },
                        },
                    ]}
                    person={personFrom({ username: 'ana', avatarKey: 'basic.frog' })}
                    requestMessage="Dinner in Berlin"
                    requestAmount="25.00 EUR"
                    bankRowProps={{ bankPayable: true, remainingUsd: 27 }}
                    onUnavailable={noop}
                />
            </div>
        ),
    },
    '89-f-withdraw-review-insufficient': {
        ...SURFACE_META['89-f-withdraw-review-insufficient'],
        render: () => <WithdrawReviewSurface />,
    },
    '90-f-withdraw-review-processing': {
        ...SURFACE_META['90-f-withdraw-review-processing'],
        render: () => <WithdrawReviewSurface isProcessing />,
    },
    '91-f-withdraw-review-spent': {
        ...SURFACE_META['91-f-withdraw-review-spent'],
        render: () => <WithdrawReviewSurface alreadySpent />,
    },
    '92-f-deposit-account-closed': {
        ...SURFACE_META['92-f-deposit-account-closed'],
        render: () => <MantecaAccountUnavailableSurface action="deposit" />,
    },
    '93-f-withdraw-account-closed': {
        ...SURFACE_META['93-f-withdraw-account-closed'],
        render: () => <MantecaAccountUnavailableSurface action="withdraw" />,
    },
    '94-f-pix-deposit': {
        ...SURFACE_META['94-f-pix-deposit'],
        render: () => <PixDepositSurface />,
    },
    '94-g-pix-withdraw-on-its-way': {
        ...SURFACE_META['94-g-pix-withdraw-on-its-way'],
        render: () => <PixWithdrawOutcomeSurface />,
    },
    '94-h-pix-withdraw-arrived-to': {
        ...SURFACE_META['94-h-pix-withdraw-arrived-to'],
        render: () => <PixWithdrawOutcomeSurface />,
    },
    '94-i-pix-withdraw-arrived-unnamed': {
        ...SURFACE_META['94-i-pix-withdraw-arrived-unnamed'],
        render: () => <PixWithdrawOutcomeSurface unnamed />,
    },
    '94-j-pix-review-quote-moved': {
        ...SURFACE_META['94-j-pix-review-quote-moved'],
        render: () => <PixWithdrawFormSurface variant="quote-moved" />,
    },
    '94-k-pix-review-after-init': {
        ...SURFACE_META['94-k-pix-review-after-init'],
        render: () => <PixWithdrawFormSurface variant="after-init" />,
    },
    // the shot fixture's entry ended CANCELLED after this session funded it: support, never "on its way"
    '94-l-pix-withdraw-stuck': {
        ...SURFACE_META['94-l-pix-withdraw-stuck'],
        render: () => <PixWithdrawOutcomeSurface />,
    },
    '94-m-pix-withdraw-past-arrival': {
        ...SURFACE_META['94-m-pix-withdraw-past-arrival'],
        render: () => <PixWithdrawOutcomeSurface pastArrival />,
    },
    '94-n-pix-withdraw-past-arrival-unnamed': {
        ...SURFACE_META['94-n-pix-withdraw-past-arrival-unnamed'],
        render: () => <PixWithdrawOutcomeSurface unnamed pastArrival />,
    },
    '70-d-activationctas-outbound': {
        // the first-payment chooser opens on the row tap — the shot spec (or a
        // human) clicks the row; needs a fixture granting card access
        name: 'First-payment chooser',
        path: 'Home/FirstPaymentChooser.tsx',
        render: () => <ActivationCTAs onboarding={FUNDED_CARD_ONBOARDING} />,
    },
    '66-d-backupfaqlosephone': {
        name: 'Backup FAQ — lose phone',
        path: 'Profile/BackupFaqDrawers.tsx',
        render: () => <BackupFaqDrawers active="lose-phone" onClose={noop} platform="ios" />,
    },
    '67-d-backupfaqchangephone': {
        name: 'Backup FAQ — change phone',
        path: 'Profile/BackupFaqDrawers.tsx',
        render: () => <BackupFaqDrawers active="change-phone" onClose={noop} platform="ios" />,
    },
    '68-d-backupfaqexportkeys': {
        name: 'Backup FAQ — export keys',
        path: 'Profile/BackupFaqDrawers.tsx',
        render: () => <BackupFaqDrawers active="export-keys" onClose={noop} platform="ios" />,
    },
}

/** The open reworks, one render per option, so a choice can be made by eye. */
export const OPTION_SURFACES: Record<string, { name: string; render: () => React.ReactNode }> = {
    'opt-passkey-a': { name: 'PasskeySetupHelpDrawer — A', render: () => <PasskeyHelpA /> },
    'opt-passkey-b': { name: 'PasskeySetupHelpDrawer — B', render: () => <PasskeyHelpB /> },
    'opt-passkey-c': { name: 'PasskeySetupHelpDrawer — C', render: () => <PasskeyHelpC /> },
    'opt-passkey-d': { name: 'PasskeySetupHelpDrawer — D', render: () => <PasskeyHelpD /> },
}

export const SURFACE_IDS = Object.keys(SURFACE_META).sort()
