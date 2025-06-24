'use client'

import { COUNTRY_SPECIFIC_METHODS, countryData, SpecificPaymentMethod } from '@/components/AddMoney/consts'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { IconName } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { SearchResultCard } from '@/components/SearchUsers/SearchResultCard'
import { getColorForUsername } from '@/utils/color.utils'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import EmptyState from '../Global/EmptyStates/EmptyState'
import { useAuth } from '@/context/authContext'
import { useEffect, useRef, useState } from 'react'
import { InitiateKYCModal } from '@/components/Kyc'
import { DynamicBankAccountForm, FormData } from './DynamicBankAccountForm'
import { addBankAccount, updateUserById } from '@/app/actions/users'
import { jsonParse, jsonStringify } from '@/utils/general.utils'
import { KYCStatus } from '@/utils/bridge-accounts.utils'
import { AddBankAccountPayload } from '@/app/actions/types/users.types'
import { useWebSocket } from '@/hooks/useWebSocket'

interface AddWithdrawCountriesListProps {
    flow: 'add' | 'withdraw'
}

const AddWithdrawCountriesList = ({ flow }: AddWithdrawCountriesListProps) => {
    const router = useRouter()
    const params = useParams()
    const { user, fetchUser } = useAuth()
    const [view, setView] = useState<'list' | 'form'>('list')
    const [isKycModalOpen, setIsKycModalOpen] = useState(false)
    const [cachedBankDetails, setCachedBankDetails] = useState<Partial<FormData> | null>(null)
    const formRef = useRef<{ handleSubmit: () => void }>(null)
    const [liveKycStatus, setLiveKycStatus] = useState<KYCStatus | undefined>(user?.user?.kycStatus as KYCStatus)

    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: !!user?.user.username,
        onKycStatusUpdate: (newStatus) => {
            setLiveKycStatus(newStatus as KYCStatus)
        },
    })

    useEffect(() => {
        if (user?.user.kycStatus) {
            setLiveKycStatus(user.user.kycStatus as KYCStatus)
        }
    }, [user?.user.kycStatus])

    useEffect(() => {
        fetchUser()
    }, [])

    const countryPathParts = Array.isArray(params.country) ? params.country : [params.country]
    const isBankPage = countryPathParts[countryPathParts.length - 1] === 'bank'
    const countrySlugFromUrl = isBankPage ? countryPathParts.slice(0, -1).join('-') : countryPathParts.join('-')

    const currentCountry = countryData.find(
        (country) => country.type === 'country' && country.path === countrySlugFromUrl
    )

    useEffect(() => {
        if (user?.user.userId) {
            const item = sessionStorage.getItem(`temp-bank-account-${user.user.userId}`)
            const data = item ? jsonParse(item) : null
            const currentStatus = liveKycStatus || user.user.kycStatus
            if (data && currentStatus === 'approved' && !cachedBankDetails) {
                setCachedBankDetails(data)
                setView('form')
            }
        }
    }, [user, liveKycStatus, cachedBankDetails])

    const handleFormSubmit = async (payload: AddBankAccountPayload, rawData: FormData): Promise<{ error?: string }> => {
        const currentKycStatus = liveKycStatus || user?.user.kycStatus
        const isUserKycVerified = currentKycStatus === 'approved'

        const hasNameOnLoad = !!user?.user.fullName
        const hasEmailOnLoad = !!user?.user.email

        // scenario (1): happy path: if the user has already completed kyc and we have their name and email,
        // we can add the bank account directly.
        if (isUserKycVerified && (hasNameOnLoad || rawData.firstName) && (hasEmailOnLoad || rawData.email)) {
            const result = await addBankAccount(payload)
            if (result.error) {
                return { error: result.error }
            }

            // after successfully adding, we refetch user data to get the new account
            // and remove any temporary data from local storage.
            await fetchUser() // refetch user to get the new bank account
            if (user?.user.userId) {
                sessionStorage.removeItem(`temp-bank-account-${user.user.userId}`)
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
            const { firstName, lastName, email, ...detailsToSave } = rawData
            if (user?.user.userId) {
                sessionStorage.setItem(`temp-bank-account-${user.user.userId}`, jsonStringify(detailsToSave))
            }
            setIsKycModalOpen(true)
        }

        return {}
    }

    const handleKycSuccess = () => {
        setIsKycModalOpen(false)
    }

    const handleWithdrawMethodClick = (method: SpecificPaymentMethod) => {
        if (method.id.includes('default-bank-withdraw') || method.id.includes('sepa-instant-withdraw')) {
            setView('form')
        } else if (method.path) {
            router.push(method.path)
        }
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
            <div className="w-full space-y-8 self-start">
                <NavHeader title={'Withdraw'} onPrev={() => setView('list')} />
                <DynamicBankAccountForm
                    ref={formRef}
                    country={currentCountry.id}
                    onSuccess={handleFormSubmit}
                    initialData={cachedBankDetails ?? {}}
                />
                <InitiateKYCModal
                    isOpen={isKycModalOpen}
                    onClose={() => setIsKycModalOpen(false)}
                    onKycSuccess={handleKycSuccess}
                />
            </div>
        )
    }

    const methods = COUNTRY_SPECIFIC_METHODS[currentCountry.id]

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
                                                    : getColorForUsername(method.title).lightShade,
                                            color: method.icon === ('bank' as IconName) ? 'black' : 'black',
                                        }}
                                    />
                                ) : (
                                    <Image
                                        src={method.icon}
                                        alt={method.id}
                                        className="h-8 w-8 rounded-full"
                                        width={32}
                                        height={32}
                                    />
                                )
                            }
                            rightContent={method.isSoon ? <StatusBadge status="soon" size="small" /> : null}
                            onClick={() => handleWithdrawMethodClick(method)}
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
            <NavHeader title={currentCountry.title} onPrev={() => router.back()} />
            <div className="flex-1 overflow-y-auto">
                {flow === 'add' && methods?.add && renderPaymentMethods('Add money via', methods.add)}
                {flow === 'withdraw' &&
                    methods?.withdraw &&
                    renderPaymentMethods('Choose withdrawing method', methods.withdraw)}
            </div>
            <InitiateKYCModal
                isOpen={isKycModalOpen}
                onClose={() => setIsKycModalOpen(false)}
                onKycSuccess={handleKycSuccess}
            />
        </div>
    )
}

export default AddWithdrawCountriesList
