'use client'

// action list for claim flow only
// shows payment methods for claiming send links

import StatusBadge from '../../Global/Badges/StatusBadge'
import IconStack from '../../Global/IconStack'
import { ClaimBankFlowStep, useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { type ClaimLinkData } from '@/services/sendLinks'
import { formatUnits } from 'viem'
import { useContext, useMemo, useState } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import Divider from '../../0_Bruddle/Divider'
import { Button } from '@/components/0_Bruddle/Button'
import { PEANUT_LOGO_BLACK } from '@/assets/illustrations'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { PEANUTMAN_LOGO } from '@/assets/peanut'
import { BankClaimType, useDetermineBankClaimType } from '@/hooks/useDetermineBankClaimType'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import { tokenSelectorContext } from '@/context'
import { DEVCONNECT_CLAIM_METHODS, type PaymentMethod } from '@/constants/actionlist.consts'
import useClaimLink from '../useClaimLink'
import { setupActions } from '@/redux/slices/setup-slice'
import starStraightImage from '@/assets/icons/starStraight.svg'
import { useAuth } from '@/context/authContext'
import { EInviteType } from '@/services/services.types'
import ConfirmInviteModal from '../../Global/ConfirmInviteModal'
import Loading from '../../Global/Loading'
import { ActionListCard } from '../../ActionListCard'
import { useGeoFilteredPaymentOptions } from '@/hooks/useGeoFilteredPaymentOptions'
import SupportCTA from '../../Global/SupportCTA'
import { DEVCONNECT_LOGO } from '@/assets'
import useKycStatus from '@/hooks/useKycStatus'
import { MIN_BANK_TRANSFER_AMOUNT, validateMinimumAmount } from '@/constants/payment.consts'
import { useAppDispatch } from '@/redux/hooks'

const SHOW_INVITE_MODAL_FOR_DEVCONNECT = false

interface ISendLinkActionListProps {
    claimLinkData: ClaimLinkData
    isLoggedIn: boolean
    isInviteLink?: boolean
    showDevconnectMethod?: boolean
    setExternalWalletRecipient?: (recipient: { name: string | undefined; address: string }) => void
}

/**
 * shows available payment methods for claiming a send link
 * note: request flow uses RequestPotActionList instead
 */
export default function SendLinkActionList({
    claimLinkData,
    isLoggedIn,
    isInviteLink = false,
    showDevconnectMethod,
    setExternalWalletRecipient,
}: ISendLinkActionListProps) {
    const router = useRouter()
    const {
        setClaimToExternalWallet,
        setFlowStep: setClaimBankFlowStep,
        setShowVerificationModal,
        setClaimToMercadoPago,
        setRegionalMethodType,
        setHideTokenSelector,
    } = useClaimBankFlow()
    const [showMinAmountError, setShowMinAmountError] = useState(false)
    const { claimType } = useDetermineBankClaimType(claimLinkData?.sender?.userId ?? '')
    const savedAccounts = useSavedAccounts()
    const { addParamStep } = useClaimLink()
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
    const [showInviteModal, setShowInviteModal] = useState(false)
    const { user } = useAuth()
    const {
        setSelectedTokenAddress,
        setSelectedChainID,
        devconnectChainId,
        devconnectRecipientAddress,
        devconnectTokenAddress,
    } = useContext(tokenSelectorContext)
    const { isUserMantecaKycApproved } = useKycStatus()
    const dispatch = useAppDispatch()

    const requiresVerification = useMemo(() => {
        return claimType === BankClaimType.GuestKycNeeded || claimType === BankClaimType.ReceiverKycNeeded
    }, [claimType])

    // filter and sort payment methods based on geolocation
    const { filteredMethods: sortedActionMethods, isLoading: isGeoLoading } = useGeoFilteredPaymentOptions({
        sortUnavailable: true,
        isMethodUnavailable: (method) =>
            method.soon ||
            (method.id === 'bank' && requiresVerification) ||
            (['mercadopago', 'pix'].includes(method.id) && !isUserMantecaKycApproved),
        methods: showDevconnectMethod
            ? DEVCONNECT_CLAIM_METHODS.filter((method) => method.id !== 'devconnect')
            : undefined,
    })

    const handleMethodClick = async (method: PaymentMethod) => {
        const amountInUsd = parseFloat(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals))
        if (method.id === 'bank' && !validateMinimumAmount(amountInUsd, method.id)) {
            setShowMinAmountError(true)
            return
        }

        switch (method.id) {
            case 'bank':
                if (claimType === BankClaimType.GuestKycNeeded) {
                    addParamStep('bank')
                    setShowVerificationModal(true)
                } else {
                    if (savedAccounts.length) {
                        setClaimBankFlowStep(ClaimBankFlowStep.SavedAccountsList)
                    } else {
                        setClaimBankFlowStep(ClaimBankFlowStep.BankCountryList)
                    }
                }
                break
            case 'mercadopago':
            case 'pix':
                if (!user) {
                    addParamStep('regional-claim')
                    setShowVerificationModal(true)
                    return
                }
                setRegionalMethodType(method.id)
                setClaimToMercadoPago(true)
                break
            case 'devconnect':
                setExternalWalletRecipient?.({
                    address: devconnectRecipientAddress,
                    name: undefined,
                })
                setSelectedTokenAddress(devconnectTokenAddress)
                setSelectedChainID(devconnectChainId)
                setHideTokenSelector(true)
                setClaimToExternalWallet(true)
                break
            case 'exchange-or-wallet':
                setClaimToExternalWallet(true)
                break
        }
    }

    const handleContinueWithPeanut = () => {
        addParamStep('claim')
        const redirectUri = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)
        const rawUsername = claimLinkData?.sender?.username
        if (isInviteLink && !userHasAppAccess && rawUsername) {
            const username = rawUsername.toUpperCase()
            const inviteCode = `${username}INVITESYOU`
            dispatch(setupActions.setInviteCode(inviteCode))
            dispatch(setupActions.setInviteType(EInviteType.PAYMENT_LINK))
            router.push(`/invite?code=${inviteCode}&redirect_uri=${redirectUri}`)
        } else {
            router.push(`/setup?redirect_uri=${redirectUri}`)
        }
    }

    const username = claimLinkData?.sender?.username
    const userHasAppAccess = user?.user?.hasAppAccess ?? false
    const devconnectMethod = DEVCONNECT_CLAIM_METHODS.find((m) => m.id === 'devconnect')!

    if (isGeoLoading) {
        return (
            <div className="flex w-full items-center justify-center py-8">
                <Loading />
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {showDevconnectMethod && (
                <>
                    <Button
                        variant="primary-soft"
                        shadowSize="4"
                        icon="arrow-down"
                        onClick={() => {
                            if (SHOW_INVITE_MODAL_FOR_DEVCONNECT) {
                                setSelectedMethod(devconnectMethod)
                                setShowInviteModal(true)
                            } else {
                                handleMethodClick(devconnectMethod)
                            }
                        }}
                    >
                        <div className="flex items-center gap-1">
                            Claim on <Image src={DEVCONNECT_LOGO} alt="Devconnect Logo" className="size-5" /> Devconnect
                            app
                        </div>
                    </Button>
                    <Divider text="or" />
                </>
            )}

            {!isLoggedIn && (
                <Button
                    icon={showDevconnectMethod ? 'arrow-down' : undefined}
                    shadowSize="4"
                    onClick={handleContinueWithPeanut}
                    className="flex w-full items-center gap-1"
                >
                    {showDevconnectMethod ? <div>Claim on</div> : <div>Continue with </div>}
                    <div className="flex items-center gap-1">
                        <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" className="size-5" />
                        <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                    </div>
                </Button>
            )}

            {SHOW_INVITE_MODAL_FOR_DEVCONNECT && isInviteLink && !userHasAppAccess && username && (
                <div className="!mt-6 flex w-full items-center justify-center gap-1 md:gap-2">
                    <Image src={starStraightImage.src} alt="star" width={20} height={20} />
                    <p className="text-center text-sm">Invited by {username}, you have early access!</p>
                    <Image src={starStraightImage.src} alt="star" width={20} height={20} />
                </div>
            )}

            <Divider text="or" />

            <div className="space-y-2">
                {sortedActionMethods.map((method) => {
                    let methodRequiresVerification = method.id === 'bank' && requiresVerification
                    if (!isUserMantecaKycApproved && ['mercadopago', 'pix'].includes(method.id)) {
                        methodRequiresVerification = true
                    }

                    return (
                        <MethodCard
                            onClick={() => {
                                if (isInviteLink && !userHasAppAccess && method.id !== 'devconnect') {
                                    setSelectedMethod(method)
                                    setShowInviteModal(true)
                                } else {
                                    handleMethodClick(method)
                                }
                            }}
                            key={method.id}
                            method={method}
                            requiresVerification={methodRequiresVerification}
                        />
                    )
                })}
            </div>

            {!isLoggedIn && <SupportCTA />}

            <ActionModal
                visible={showMinAmountError}
                onClose={() => setShowMinAmountError(false)}
                title="Minimum Amount"
                description={`The minimum amount for this payment method is $${MIN_BANK_TRANSFER_AMOUNT}. Please enter a higher amount or try a different method.`}
                icon="alert"
                ctas={[{ text: 'Close', shadowSize: '4', onClick: () => setShowMinAmountError(false) }]}
                iconContainerClassName="bg-yellow-400"
                preventClose={false}
                modalPanelClassName="max-w-md mx-8"
            />

            <ConfirmInviteModal
                method={selectedMethod?.title ?? ''}
                handleContinueWithPeanut={handleContinueWithPeanut}
                handleLoseInvite={() => {
                    if (selectedMethod) {
                        handleMethodClick(selectedMethod)
                        setShowInviteModal(false)
                        setSelectedMethod(null)
                    }
                }}
                isOpen={showInviteModal}
                onClose={() => {
                    setShowInviteModal(false)
                    setSelectedMethod(null)
                }}
            />
        </div>
    )
}

const MethodCard = ({
    method,
    onClick,
    requiresVerification,
    isDisabled,
}: {
    method: PaymentMethod
    onClick: () => void
    requiresVerification?: boolean
    isDisabled?: boolean
}) => {
    return (
        <ActionListCard
            position="single"
            description={method.description}
            descriptionClassName="text-[12px]"
            title={
                <div className="flex items-center gap-2">
                    {method.title}
                    {(method.soon || requiresVerification) && (
                        <StatusBadge
                            status={requiresVerification ? 'custom' : 'soon'}
                            customText={requiresVerification ? 'REQUIRES VERIFICATION' : ''}
                        />
                    )}
                </div>
            }
            onClick={onClick}
            isDisabled={method.soon || isDisabled}
            rightContent={<IconStack icons={method.icons} iconSize={method.id === 'bank' ? 80 : 24} />}
        />
    )
}
