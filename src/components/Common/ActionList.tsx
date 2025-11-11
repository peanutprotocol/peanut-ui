'use client'

import StatusBadge from '../Global/Badges/StatusBadge'
import IconStack from '../Global/IconStack'
import { ClaimBankFlowStep, useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { type ClaimLinkData } from '@/services/sendLinks'
import { formatUnits } from 'viem'
import { useContext, useMemo, useState } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import Divider from '../0_Bruddle/Divider'
import { Button } from '../0_Bruddle'
import { PEANUT_LOGO_BLACK } from '@/assets/illustrations'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { PEANUTMAN_LOGO } from '@/assets/peanut'
import { BankClaimType, useDetermineBankClaimType } from '@/hooks/useDetermineBankClaimType'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import { RequestFulfillmentBankFlowStep, useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'
import { type ParsedURL } from '@/lib/url-parser/types/payment'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { BankRequestType, useDetermineBankRequestType } from '@/hooks/useDetermineBankRequestType'
import { GuestVerificationModal } from '../Global/GuestVerificationModal'
import ActionListDaimoPayButton from './ActionListDaimoPayButton'
import { DEVCONNECT_CLAIM_METHODS, type PaymentMethod } from '@/constants/actionlist.consts'
import useClaimLink from '../Claim/useClaimLink'
import { setupActions } from '@/redux/slices/setup-slice'
import starStraightImage from '@/assets/icons/starStraight.svg'
import { useAuth } from '@/context/authContext'
import { EInviteType } from '@/services/services.types'
import ConfirmInviteModal from '../Global/ConfirmInviteModal'
import Loading from '../Global/Loading'
import { useWallet } from '@/hooks/wallet/useWallet'
import { ActionListCard } from '../ActionListCard'
import { useGeoFilteredPaymentOptions } from '@/hooks/useGeoFilteredPaymentOptions'
import { tokenSelectorContext } from '@/context'
import SupportCTA from '../Global/SupportCTA'
import { usePaymentInitiator, type InitiatePaymentPayload } from '@/hooks/usePaymentInitiator'
import useKycStatus from '@/hooks/useKycStatus'

interface IActionListProps {
    flow: 'claim' | 'request'
    claimLinkData?: ClaimLinkData
    requestLinkData?: ParsedURL
    isLoggedIn: boolean
    isInviteLink?: boolean
    showDevconnectMethod?: boolean
    setExternalWalletRecipient?: (recipient: { name: string | undefined; address: string }) => void
    usdAmount?: string
}

/**
 * Shows a list of available payment methods to choose from for claiming a send link or fullfilling a request link
 *
 * @param {object} props
 * @param {ClaimLinkData} props.claimLinkData The claim link data
 * @param {boolean} props.isLoggedIn Whether the user is logged in, used to show cta for continue with peanut if not logged in
 * @returns {JSX.Element}
 */
export default function ActionList({
    claimLinkData,
    isLoggedIn,
    flow,
    requestLinkData,
    isInviteLink = false,
    showDevconnectMethod,
    setExternalWalletRecipient,
    usdAmount: usdAmountValue,
}: IActionListProps) {
    const router = useRouter()
    const {
        setClaimToExternalWallet,
        setFlowStep: setClaimBankFlowStep,
        setShowVerificationModal,
        setClaimToMercadoPago,
        setRegionalMethodType,
        setHideTokenSelector,
    } = useClaimBankFlow()
    const { balance } = useWallet()
    const [showMinAmountError, setShowMinAmountError] = useState(false)
    const { claimType } = useDetermineBankClaimType(claimLinkData?.sender?.userId ?? '')
    const { chargeDetails, usdAmount, parsedPaymentData } = usePaymentStore()
    const requesterUserId = chargeDetails?.requestLink?.recipientAccount?.userId ?? ''
    const { requestType } = useDetermineBankRequestType(requesterUserId)
    const savedAccounts = useSavedAccounts()
    const { addParamStep } = useClaimLink()
    const {
        setShowRequestFulfilmentBankFlowManager,
        setShowExternalWalletFulfillMethods,
        setFlowStep: setRequestFulfilmentBankFlowStep,
        setFulfillUsingManteca,
        setRegionalMethodType: setRequestFulfillmentRegionalMethodType,
        setTriggerPayWithPeanut,
    } = useRequestFulfillmentFlow()
    const [isGuestVerificationModalOpen, setIsGuestVerificationModalOpen] = useState(false)
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
    const [isUsePeanutBalanceModalShown, setIsUsePeanutBalanceModalShown] = useState(false)
    const [showUsePeanutBalanceModal, setShowUsePeanutBalanceModal] = useState(false)
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)
    const { initiatePayment } = usePaymentInitiator()
    const { isUserMantecaKycApproved } = useKycStatus()

    const dispatch = useAppDispatch()

    const requiresVerification = useMemo(() => {
        if (flow === 'claim') {
            return claimType === BankClaimType.GuestKycNeeded || claimType === BankClaimType.ReceiverKycNeeded
        }
        if (flow === 'request') {
            return requestType === BankRequestType.GuestKycNeeded || requestType === BankRequestType.PayerKycNeeded
        }
        return false
    }, [claimType, requestType, flow])

    // use the hook to filter and sort payment methods based on geolocation
    const { filteredMethods: sortedActionMethods, isLoading: isGeoLoading } = useGeoFilteredPaymentOptions({
        sortUnavailable: true,
        isMethodUnavailable: (method) =>
            method.soon ||
            (method.id === 'bank' && requiresVerification) ||
            (['mercadopago', 'pix'].includes(method.id) && !isUserMantecaKycApproved),
        methods: showDevconnectMethod ? DEVCONNECT_CLAIM_METHODS : undefined,
    })

    // Check if user has enough Peanut balance to pay for the request
    const amountInUsd = usdAmount ? parseFloat(usdAmount) : 0
    const hasSufficientPeanutBalance = user && balance && Number(balance) >= amountInUsd

    // check if amount is valid for request flow
    const currentRequestAmount = usdAmountValue ?? usdAmount
    const requestAmountValue = currentRequestAmount ? parseFloat(currentRequestAmount) : 0
    const isAmountEntered = flow === 'request' ? !!currentRequestAmount && requestAmountValue > 0 : true

    const handleMethodClick = async (method: PaymentMethod, bypassBalanceModal = false) => {
        // validate minimum amount for bank/mercado pago/pix in request flow
        if (flow === 'request' && requestLinkData) {
            // check minimum amount for bank/mercado pago/pix
            if (['bank', 'mercadopago', 'pix'].includes(method.id) && requestAmountValue < 5) {
                setShowMinAmountError(true)
                return
            }
        }

        // For request flow: Check if user has sufficient Peanut balance and hasn't dismissed the modal
        if (flow === 'request' && requestLinkData && !bypassBalanceModal) {
            if (!isUsePeanutBalanceModalShown && hasSufficientPeanutBalance) {
                setSelectedPaymentMethod(method) // Store the method they want to use
                setShowUsePeanutBalanceModal(true)
                return // Show modal, don't proceed with method yet
            }
        }

        if (flow === 'claim' && claimLinkData) {
            const amountInUsd = parseFloat(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals))
            if (method.id === 'bank' && amountInUsd < 5) {
                setShowMinAmountError(true)
                return
            }
            switch (method.id) {
                case 'bank':
                    {
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
                        address: devconnectRecipientAddress, // Address sent from devconnect app
                        name: undefined,
                    })
                    // For devconnect claims we need to set address and chain from the url params
                    setSelectedTokenAddress(devconnectTokenAddress)
                    setSelectedChainID(devconnectChainId)
                    setHideTokenSelector(true)
                    setClaimToExternalWallet(true)
                    break
                case 'exchange-or-wallet':
                    setClaimToExternalWallet(true)
                    break
            }
        } else if (flow === 'request' && requestLinkData) {
            // @dev TODO: Fix req fulfillment with bank properly post devconnect
            // if (method.id === 'bank') {
            //     if (user?.user) {
            //         router.push('/add-money')
            //     } else {
            //         const redirectUri = encodeURIComponent('/add-money')
            //         router.push(`/setup?redirect_uri=${redirectUri}`)
            //     }
            //     return
            // }

            switch (method.id) {
                case 'bank':
                    if (requestType === BankRequestType.GuestKycNeeded) {
                        addParamStep('bank')
                        setIsGuestVerificationModalOpen(true)
                    } else {
                        if (!chargeDetails && parsedPaymentData) {
                            const payload: InitiatePaymentPayload = {
                                recipient: parsedPaymentData?.recipient,
                                tokenAmount: usdAmount ?? '0',
                                isExternalWalletFlow: false,
                                transactionType: 'REQUEST',
                                returnAfterChargeCreation: true,
                            }

                            await initiatePayment(payload)
                        }

                        setShowRequestFulfilmentBankFlowManager(true)
                        setRequestFulfilmentBankFlowStep(RequestFulfillmentBankFlowStep.BankCountryList)
                    }
                    break
                case 'mercadopago':
                case 'pix':
                    // note: we only check for manteca kyc in request flow cuz claim has its own verification logic based on senders/receivers kyc status
                    if (!user || !isUserMantecaKycApproved) {
                        addParamStep('regional-req-fulfill')
                        setIsGuestVerificationModalOpen(true)
                        return
                    }
                    setRequestFulfillmentRegionalMethodType(method.id)
                    setFulfillUsingManteca(true)
                    break
                case 'exchange-or-wallet':
                    setShowExternalWalletFulfillMethods(true)
                    break
            }
        }
    }

    const handleContinueWithPeanut = () => {
        if (flow === 'claim') {
            addParamStep('claim')
        }
        // push to setup page with redirect uri, to prevent the user from losing the flow context
        const redirectUri = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)
        const rawUsername =
            flow === 'request' ? requestLinkData?.recipient?.identifier : claimLinkData?.sender?.username
        if (isInviteLink && !userHasAppAccess && rawUsername) {
            const username = rawUsername ? rawUsername.toUpperCase() : ''
            const inviteCode = `${username}INVITESYOU`
            dispatch(setupActions.setInviteCode(inviteCode))
            dispatch(setupActions.setInviteType(EInviteType.PAYMENT_LINK))
            router.push(`/invite?code=${inviteCode}&redirect_uri=${redirectUri}`)
        } else {
            router.push(`/setup?redirect_uri=${redirectUri}`)
        }
    }

    const username = claimLinkData?.sender?.username ?? requestLinkData?.recipient?.identifier
    const userHasAppAccess = user?.user?.hasAppAccess ?? false

    if (isGeoLoading) {
        return (
            <div className="flex w-full items-center justify-center py-8">
                <Loading />
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {!isLoggedIn && (
                <Button shadowSize="4" onClick={handleContinueWithPeanut} className="flex w-full items-center gap-1">
                    <div>Continue with </div>
                    <div className="flex items-center gap-1">
                        <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" className="size-5" />
                        <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                    </div>
                </Button>
            )}
            {isInviteLink && !userHasAppAccess && username && (
                <div className="!mt-6 flex w-full items-center justify-center gap-1 md:gap-2">
                    <Image src={starStraightImage.src} alt="star" width={20} height={20} />{' '}
                    <p className="text-center text-sm">Invited by {username}, you have early access!</p>
                    <Image src={starStraightImage.src} alt="star" width={20} height={20} />
                </div>
            )}
            <Divider text="or" />
            <div className="space-y-2">
                {sortedActionMethods.map((method) => {
                    if (flow === 'request' && method.id === 'exchange-or-wallet') {
                        return (
                            <div key={method.id}>
                                <ActionListDaimoPayButton
                                    handleContinueWithPeanut={handleContinueWithPeanut}
                                    showConfirmModal={isInviteLink && !userHasAppAccess}
                                    onBeforeShow={() => {
                                        // Check balance before showing Daimo widget
                                        if (!isUsePeanutBalanceModalShown && hasSufficientPeanutBalance) {
                                            setSelectedPaymentMethod(method)
                                            setShowUsePeanutBalanceModal(true)
                                            return false // Don't show Daimo yet
                                        }
                                        return true // Proceed with Daimo
                                    }}
                                    isDisabled={!isAmountEntered}
                                />
                            </div>
                        )
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
                            requiresVerification={
                                (method.id === 'bank' && requiresVerification) ||
                                (['mercadopago', 'pix'].includes(method.id) && !isUserMantecaKycApproved)
                            }
                            isDisabled={!isAmountEntered}
                        />
                    )
                })}
            </div>
            {flow === 'claim' && !isLoggedIn && <SupportCTA />}
            <ActionModal
                visible={showMinAmountError}
                onClose={() => setShowMinAmountError(false)}
                title="Minimum Amount "
                description={'The minimum amount for a this payment method is $5. Please try a different method.'}
                icon="alert"
                ctas={[{ text: 'Close', shadowSize: '4', onClick: () => setShowMinAmountError(false) }]}
                iconContainerClassName="bg-yellow-400"
                preventClose={false}
                modalPanelClassName="max-w-md mx-8"
            />

            <GuestVerificationModal
                secondaryCtaLabel="Use other method"
                isOpen={isGuestVerificationModalOpen}
                onClose={() => setIsGuestVerificationModalOpen(false)}
                description="To fulfill this request using bank account, please create an account and verify your identity."
                redirectToVerification
            />

            {/* Invites modal */}

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

            <ActionModal
                visible={showUsePeanutBalanceModal}
                onClose={() => {
                    setShowUsePeanutBalanceModal(false)
                    setIsUsePeanutBalanceModalShown(true)
                    setSelectedPaymentMethod(null)
                }}
                title="Use your Peanut balance instead"
                description={
                    'You already have enough funds in your Peanut account. Using this method is instant and avoids delays.'
                }
                icon="user-plus"
                ctas={[
                    {
                        text: 'Pay with Peanut',
                        shadowSize: '4',
                        onClick: () => {
                            setShowUsePeanutBalanceModal(false)
                            setIsUsePeanutBalanceModalShown(true)
                            setSelectedPaymentMethod(null)
                            setTriggerPayWithPeanut(true)
                        },
                    },
                    {
                        text: 'Continue',
                        shadowSize: '4',
                        variant: 'stroke',
                        onClick: () => {
                            setShowUsePeanutBalanceModal(false)
                            setIsUsePeanutBalanceModalShown(true)
                            // Proceed with the method the user originally selected
                            if (selectedPaymentMethod) {
                                handleMethodClick(selectedPaymentMethod, true) // true = bypass modal check
                            }
                            setSelectedPaymentMethod(null)
                        },
                    },
                ]}
                iconContainerClassName="bg-primary-1"
                preventClose={false}
                modalPanelClassName="max-w-md mx-8"
            />
        </div>
    )
}

export const MethodCard = ({
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
