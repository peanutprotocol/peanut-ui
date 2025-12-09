'use client'

import { COUNTRY_SPECIFIC_METHODS, countryData, type SpecificPaymentMethod } from '@/components/AddMoney/consts'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { type IconName } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { getColorForUsername } from '@/utils/color.utils'
import Image, { type StaticImageData } from 'next/image'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import EmptyState from '../Global/EmptyStates/EmptyState'
import { useAuth } from '@/context/authContext'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DynamicBankAccountForm, type IBankAccountDetails } from './DynamicBankAccountForm'
import { addBankAccount } from '@/app/actions/users'
import { type BridgeKycStatus } from '@/utils/bridge-accounts.utils'
import { type AddBankAccountPayload } from '@/app/actions/types/users.types'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { type Account } from '@/interfaces'
import { getCountryCodeForWithdraw } from '@/utils/withdraw.utils'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import CryptoMethodDrawer from '../AddMoney/components/CryptoMethodDrawer'
import { useAppDispatch } from '@/redux/hooks'
import { bankFormActions } from '@/redux/slices/bank-form-slice'
import { InitiateBridgeKYCModal } from '../Kyc/InitiateBridgeKYCModal'
import useKycStatus from '@/hooks/useKycStatus'
import KycVerifiedOrReviewModal from '../Global/KycVerifiedOrReviewModal'
import { ActionListCard } from '@/components/ActionListCard'

interface AddWithdrawCountriesListProps {
    flow: 'add' | 'withdraw'
}

const AddWithdrawCountriesList = ({ flow }: AddWithdrawCountriesListProps) => {
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()

    // check if coming from send flow and what type
    const methodParam = searchParams.get('method')
    const isFromSendFlow = !!(methodParam && ['bank', 'crypto'].includes(methodParam))
    const isBankFromSend = methodParam === 'bank' && isFromSendFlow

    // hooks
    const { deviceType } = useDeviceType()
    const { user, fetchUser } = useAuth()
    const { setSelectedBankAccount, amountToWithdraw, setSelectedMethod, setAmountToWithdraw } = useWithdrawFlow()
    const dispatch = useAppDispatch()

    // component level states
    const [view, setView] = useState<'list' | 'form'>(flow === 'withdraw' && amountToWithdraw ? 'form' : 'list')
    const [isKycModalOpen, setIsKycModalOpen] = useState(false)
    const formRef = useRef<{ handleSubmit: () => void }>(null)
    const [liveKycStatus, setLiveKycStatus] = useState<BridgeKycStatus | undefined>(
        user?.user?.bridgeKycStatus as BridgeKycStatus
    )
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    const { isUserBridgeKycUnderReview } = useKycStatus()
    const [showKycStatusModal, setShowKycStatusModal] = useState(false)

    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: !!user?.user.username,
        onKycStatusUpdate: (newStatus) => {
            setLiveKycStatus(newStatus as BridgeKycStatus)
        },
    })

    useEffect(() => {
        if (user?.user.bridgeKycStatus) {
            setLiveKycStatus(user.user.bridgeKycStatus as BridgeKycStatus)
        }
    }, [user?.user.bridgeKycStatus])

    const countryPathParts = Array.isArray(params.country) ? params.country : [params.country]
    const isBankPage = countryPathParts[countryPathParts.length - 1] === 'bank'
    const countrySlugFromUrl = isBankPage ? countryPathParts.slice(0, -1).join('-') : countryPathParts.join('-')

    const currentCountry = countryData.find(
        (country) => country.type === 'country' && country.path === countrySlugFromUrl
    )

    const handleFormSubmit = async (
        payload: AddBankAccountPayload,
        rawData: IBankAccountDetails
    ): Promise<{ error?: string }> => {
        const currentKycStatus = liveKycStatus || user?.user.bridgeKycStatus
        const isUserKycVerified = currentKycStatus === 'approved'

        const hasEmailOnLoad = !!user?.user.email

        // scenario (1): happy path: if the user has already completed kyc, we can add the bank account directly
        // note: we no longer check for fullName as account owner name is now always collected from the form
        if (isUserKycVerified && (hasEmailOnLoad || rawData.email)) {
            const currentAccountIds = new Set(user?.accounts.map((acc) => acc.id) ?? [])

            const result = await addBankAccount(payload)
            if (result.error) {
                return { error: result.error }
            }
            if (!result.data) {
                return { error: 'Failed to process bank account. Please try again or contact support.' }
            }

            // after successfully adding, we refetch user data to get the new account
            // and remove any temporary data from local storage.
            const updatedUser = await fetchUser() // refetch user to get the new bank account

            const newAccount = updatedUser?.accounts.find((acc) => !currentAccountIds.has(acc.id))

            if (newAccount) {
                setSelectedBankAccount(newAccount)
            } else {
                // fallback to the previous method if we can't find the new account
                // this can happen if the user object is not updated immediately
                const newAccountFromResponse = result.data as Account
                // ensure details has accountOwnerName for confirmation page display
                newAccountFromResponse.details = {
                    ...(newAccountFromResponse.details || {}),
                    countryCode: payload.countryCode,
                    countryName: payload.countryName,
                    bankName: newAccountFromResponse.details?.bankName || null,
                    accountOwnerName: `${payload.accountOwnerName.firstName} ${payload.accountOwnerName.lastName}`,
                }
                setSelectedBankAccount(newAccountFromResponse)
            }

            if (currentCountry) {
                const queryParams = isBankFromSend ? `?method=${methodParam}` : ''
                router.push(`/withdraw/${currentCountry.path}/bank${queryParams}`)
            }
            return {}
        }

        // scenario (2): if the user hasn't completed kyc yet
        if (!isUserKycVerified) {
            setIsKycModalOpen(true)
        }

        return {}
    }

    const handleKycSuccess = () => {
        // only transition to form if this component initiated the KYC modal
        if (isKycModalOpen) {
            setIsKycModalOpen(false)
            setView('form')
        }
    }

    const handleWithdrawMethodClick = (method: SpecificPaymentMethod) => {
        // preserve method param only if coming from bank send flow (not crypto)
        const methodQueryParam = isBankFromSend ? `?method=${methodParam}` : ''

        if (method.path && method.path.includes('/manteca')) {
            // Manteca methods route directly (has own amount input)
            const separator = method.path.includes('?') ? '&' : '?'
            const additionalParams = isBankFromSend ? `${separator}method=${methodParam}` : ''
            router.push(`${method.path}${additionalParams}`)
        } else if (method.id.includes('default-bank-withdraw') || method.id.includes('sepa-instant-withdraw')) {
            if (isUserBridgeKycUnderReview) {
                setShowKycStatusModal(true)
                return
            }

            // Bridge methods: Set in context and navigate for amount input
            setSelectedMethod({
                type: 'bridge',
                countryPath: currentCountry?.path,
                currency: currentCountry?.currency,
                title: method.title,
            })
            router.push(`/withdraw${methodQueryParam}`)
            return
        } else if (method.id.includes('crypto-withdraw')) {
            setSelectedMethod({
                type: 'crypto',
                countryPath: 'crypto',
                title: 'Crypto',
            })
            router.push(`/withdraw${methodQueryParam}`)
        } else if (method.path) {
            // Other methods with paths
            const separator = method.path.includes('?') ? '&' : '?'
            const additionalParams = isBankFromSend ? `${separator}method=${methodParam}` : ''
            router.push(`${method.path}${additionalParams}`)
        }
    }

    const handleAddMethodClick = (method: SpecificPaymentMethod) => {
        if (method.path) {
            if (method.id === 'crypto-add') {
                setIsDrawerOpen(true)
                return
            }
            // show kyc status modal if user is kyc under review
            if (isUserBridgeKycUnderReview) {
                setShowKycStatusModal(true)
                return
            }

            router.push(method.path)
        }
    }

    const methods = useMemo(() => {
        if (!currentCountry) return undefined

        const countryMethods = COUNTRY_SPECIFIC_METHODS[currentCountry.id]
        if (!countryMethods) return undefined

        if (flow !== 'add') {
            return countryMethods
        }

        // filter apple pay and google pay for add flow based on device type
        const filteredAddMethods = (countryMethods.add || []).filter((method) => {
            if (method.id === 'apple-pay-add') {
                return deviceType === DeviceType.IOS || deviceType === DeviceType.WEB
            }
            if (method.id === 'google-pay-add') {
                return deviceType === DeviceType.ANDROID || deviceType === DeviceType.WEB
            }

            return true
        })

        return {
            ...countryMethods,
            add: filteredAddMethods,
        }
    }, [currentCountry, flow, deviceType])

    if (!currentCountry) {
        return (
            <div className="space-y-8 self-start">
                <NavHeader title="Not Found" onPrev={() => router.back()} />
                <EmptyState title="Country not found" description="Please try a different country." icon="search" />
            </div>
        )
    }

    if (view === 'form') {
        return (
            <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
                <NavHeader
                    title={flow === 'withdraw' ? (isBankFromSend ? 'Send' : 'Withdraw') : 'Add money'}
                    onPrev={() => {
                        // clear dynamicbankaccountform data
                        dispatch(bankFormActions.clearFormData())
                        setAmountToWithdraw('')
                        // ensure kyc modal isn't open so late success events don't flip view
                        setIsKycModalOpen(false)

                        // if coming from send flow, go back to amount input on /withdraw?method=bank
                        if (flow === 'withdraw' && isBankFromSend) {
                            if (currentCountry) {
                                setSelectedMethod({
                                    type: 'bridge',
                                    countryPath: currentCountry.path,
                                    currency: currentCountry.currency,
                                    title: 'To Bank',
                                })
                            }
                            router.push(`/withdraw?method=${methodParam}`)
                            return
                        }

                        // otherwise go back to list
                        setSelectedMethod(null)
                        setView('list')
                    }}
                />
                <DynamicBankAccountForm
                    ref={formRef}
                    country={getCountryCodeForWithdraw(currentCountry.id)}
                    onSuccess={handleFormSubmit}
                    initialData={{}}
                    error={null}
                />
                <InitiateBridgeKYCModal
                    isOpen={isKycModalOpen}
                    onClose={() => setIsKycModalOpen(false)}
                    onKycSuccess={handleKycSuccess}
                />
            </div>
        )
    }

    const renderPaymentMethods = (title: string, paymentMethods: SpecificPaymentMethod[]) => {
        if (!paymentMethods || paymentMethods.length === 0) {
            return null
        }

        return (
            <div className="space-y-2">
                <h2 className="text-base font-bold">{title}</h2>
                <div className="flex flex-col">
                    {paymentMethods.map((method, index) => (
                        <ActionListCard
                            key={method.id}
                            isDisabled={method.isSoon}
                            title={method.title}
                            description={method.description}
                            descriptionClassName={'text-xs'}
                            leftIcon={
                                typeof method.icon === 'string' || method.icon === undefined ? (
                                    <AvatarWithBadge
                                        icon={method.icon as IconName}
                                        name={method.title ?? method.id}
                                        size="extra-small"
                                        inlineStyle={{
                                            backgroundColor:
                                                method.icon === ('bank' as IconName)
                                                    ? '#FFC900'
                                                    : method.id === 'crypto-add' || method.id === 'crypto-withdraw'
                                                      ? '#FFC900'
                                                      : getColorForUsername(method.title).lightShade,
                                            color: method.icon === ('bank' as IconName) ? 'black' : 'black',
                                        }}
                                    />
                                ) : (
                                    <Image
                                        src={method.icon as StaticImageData}
                                        alt={method.id}
                                        className="h-8 w-8 rounded-full"
                                        width={32}
                                        height={32}
                                    />
                                )
                            }
                            rightContent={method.isSoon ? <StatusBadge status="soon" size="small" /> : null}
                            onClick={() => {
                                if (flow === 'withdraw') {
                                    handleWithdrawMethodClick(method)
                                } else if (method.path) {
                                    handleAddMethodClick(method)
                                }
                            }}
                            position={
                                paymentMethods.length === 1
                                    ? 'single'
                                    : index === 0
                                      ? 'first'
                                      : index === paymentMethods.length - 1
                                        ? 'last'
                                        : 'middle'
                            }
                        />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="w-full space-y-8 self-start">
            <NavHeader
                title={currentCountry.title}
                onPrev={() => {
                    setAmountToWithdraw('')
                    if (flow === 'add') {
                        router.push('/add-money')
                    } else if (isBankFromSend) {
                        // if coming from bank send flow: set method and go to amount input view
                        setSelectedMethod({
                            type: 'bridge',
                            countryPath: currentCountry.path,
                            currency: currentCountry.currency,
                            title: 'To Bank',
                        })
                        router.push(`/withdraw?method=${methodParam}`)
                    } else {
                        setSelectedMethod(null)
                        router.back()
                    }
                }}
            />
            <div className="flex-1 overflow-y-auto">
                {flow === 'add' && methods?.add && renderPaymentMethods('Add money via', methods.add)}
                {flow === 'withdraw' &&
                    methods?.withdraw &&
                    renderPaymentMethods('Choose withdrawing method', methods.withdraw)}
            </div>
            {flow === 'add' && (
                <CryptoMethodDrawer
                    isDrawerOpen={isDrawerOpen}
                    setisDrawerOpen={setIsDrawerOpen}
                    closeDrawer={() => setIsDrawerOpen(false)}
                />
            )}
            <KycVerifiedOrReviewModal
                isKycApprovedModalOpen={showKycStatusModal}
                onClose={() => setShowKycStatusModal(false)}
            />
            <InitiateBridgeKYCModal
                isOpen={isKycModalOpen}
                onClose={() => setIsKycModalOpen(false)}
                onKycSuccess={handleKycSuccess}
            />
        </div>
    )
}

export default AddWithdrawCountriesList
