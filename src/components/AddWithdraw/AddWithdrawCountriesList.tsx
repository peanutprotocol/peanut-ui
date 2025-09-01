'use client'

import { COUNTRY_SPECIFIC_METHODS, countryData, SpecificPaymentMethod } from '@/components/AddMoney/consts'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { IconName } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { SearchResultCard } from '@/components/SearchUsers/SearchResultCard'
import { getColorForUsername } from '@/utils/color.utils'
import Image, { StaticImageData } from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import EmptyState from '../Global/EmptyStates/EmptyState'
import { useAuth } from '@/context/authContext'
import { useEffect, useMemo, useRef, useState } from 'react'
import { InitiateKYCModal } from '@/components/Kyc'
import { DynamicBankAccountForm, IBankAccountDetails } from './DynamicBankAccountForm'
import { addBankAccount, updateUserById } from '@/app/actions/users'
import { BridgeKycStatus } from '@/utils/bridge-accounts.utils'
import { AddBankAccountPayload } from '@/app/actions/types/users.types'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { Account } from '@/interfaces'
import PeanutLoading from '../Global/PeanutLoading'
import { getCountryCodeForWithdraw } from '@/utils/withdraw.utils'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import CryptoMethodDrawer from '../AddMoney/components/CryptoMethodDrawer'

interface AddWithdrawCountriesListProps {
    flow: 'add' | 'withdraw'
}

const AddWithdrawCountriesList = ({ flow }: AddWithdrawCountriesListProps) => {
    const router = useRouter()
    const params = useParams()

    // hooks
    const { deviceType } = useDeviceType()
    const { user, fetchUser } = useAuth()
    const { setSelectedBankAccount, amountToWithdraw } = useWithdrawFlow()

    // component level states
    const [view, setView] = useState<'list' | 'form'>('list')
    const [isKycModalOpen, setIsKycModalOpen] = useState(false)
    const formRef = useRef<{ handleSubmit: () => void }>(null)
    const [liveKycStatus, setLiveKycStatus] = useState<BridgeKycStatus | undefined>(
        user?.user?.bridgeKycStatus as BridgeKycStatus
    )
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

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

    useEffect(() => {
        fetchUser()
    }, [])

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

        const hasNameOnLoad = !!user?.user.fullName
        const hasEmailOnLoad = !!user?.user.email

        // scenario (1): happy path: if the user has already completed kyc and we have their name and email,
        // we can add the bank account directly.
        if (isUserKycVerified && (hasNameOnLoad || rawData.firstName) && (hasEmailOnLoad || rawData.email)) {
            const currentAccountIds = new Set(user?.accounts.map((acc) => acc.id) ?? [])

            const result = await addBankAccount(payload)
            if (result.error) {
                return { error: result.error }
            }
            if (!result.data) {
                return { error: 'Failed to process bank account. Please try again.' }
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
                if (!newAccountFromResponse.details) {
                    newAccountFromResponse.details = {
                        countryCode: payload.countryCode,
                        countryName: payload.countryName,
                        bankName: null,
                        accountOwnerName: `${payload.accountOwnerName.firstName} ${payload.accountOwnerName.lastName}`,
                    }
                }
                setSelectedBankAccount(newAccountFromResponse)
            }

            if (currentCountry) {
                router.push(`/withdraw/${currentCountry.path}/bank`)
            }
            return {}
        }

        // if the user's profile is missing their full name or email,
        // we update it with the data they just provided in the form.
        if (!hasNameOnLoad || !hasEmailOnLoad) {
            if (user?.user.userId && rawData.firstName && rawData.lastName && rawData.email) {
                const result = await updateUserById({
                    userId: user.user.userId,
                    fullName: `${rawData.firstName} ${rawData.lastName}`.trim(),
                    email: rawData.email,
                })
                if (result.error) {
                    return { error: result.error }
                }
                await fetchUser() // refetch user data to get updated name/email
            }
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
        if (method.id.includes('default-bank-withdraw') || method.id.includes('sepa-instant-withdraw')) {
            setView('form')
        } else if (method.path) {
            router.push(method.path)
        }
    }

    useEffect(() => {
        if (flow !== 'withdraw') {
            return
        }
        if (!amountToWithdraw) {
            console.error('Amount not available in WithdrawFlowContext for withdrawal, redirecting.')
            router.push('/withdraw')
            return
        }
    }, [amountToWithdraw, router, flow])

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

    if (!amountToWithdraw && flow === 'withdraw') {
        return (
            <div className="flex h-full w-full items-center justify-center md:min-h-[80vh]">
                <PeanutLoading />
            </div>
        )
    }

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
                    title={flow === 'withdraw' ? 'Withdraw' : 'Add money'}
                    onPrev={() => {
                        // ensure kyc modal isn't open so late success events don't flip view
                        setIsKycModalOpen(false)
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
                <InitiateKYCModal
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
                        <SearchResultCard
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
                                    if (method.id === 'crypto-add') {
                                        setIsDrawerOpen(true)
                                        return
                                    }
                                    router.push(method.path)
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
                    if (flow === 'add') {
                        router.push('/add-money')
                    } else {
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
            <InitiateKYCModal
                isOpen={isKycModalOpen}
                onClose={() => setIsKycModalOpen(false)}
                onKycSuccess={handleKycSuccess}
            />
        </div>
    )
}

export default AddWithdrawCountriesList
