'use client'
import { updateUserById } from '@/app/actions/users'
import { Button } from '@/components/0_Bruddle'
import { BRIDGE_ALPHA3_TO_ALPHA2, countryData } from '@/components/AddMoney/consts'
import { UserDetailsForm, type UserDetailsFormData } from '@/components/AddMoney/UserDetailsForm'
import { CountryList } from '@/components/Common/CountryList'
import ErrorAlert from '@/components/Global/ErrorAlert'
import IframeWrapper from '@/components/Global/IframeWrapper'
import NavHeader from '@/components/Global/NavHeader'
import {
    KycVerificationInProgressModal,
    PeanutDoesntStoreAnyPersonalInformation,
} from '@/components/Kyc/KycVerificationInProgressModal'
import { MantecaGeoSpecificKycModal } from '@/components/Kyc/InitiateMantecaKYCModal'
import { useAuth } from '@/context/authContext'
import { useBridgeKycFlow } from '@/hooks/useBridgeKycFlow'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useKycStatus from '@/hooks/useKycStatus'
import { getRedirectUrl, clearRedirectUrl } from '@/utils/general.utils'
import StartVerificationModal from '@/components/IdentityVerification/StartVerificationModal'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'

const IdentityVerificationView = () => {
    const router = useRouter()
    const formRef = useRef<{ handleSubmit: () => void }>(null)
    const [isUserDetailsFormValid, setIsUserDetailsFormValid] = useState(false)
    const [isUpdatingUser, setIsUpdatingUser] = useState(false)
    const [userUpdateError, setUserUpdateError] = useState<string | null>(null)
    const [showUserDetailsForm, setShowUserDetailsForm] = useState(false)
    const [isMantecaModalOpen, setIsMantecaModalOpen] = useState(false)
    const [selectedCountry, setSelectedCountry] = useState<{ id: string; title: string } | null>(null)
    const [userClickedCountry, setUserClickedCountry] = useState<{ id: string; title: string } | null>(null)
    const { isUserBridgeKycApproved } = useKycStatus()
    const { user, fetchUser } = useAuth()
    const [isStartVerificationModalOpen, setIsStartVerificationModalOpen] = useState(false)
    const params = useParams()
    const countryParam = params.country as string
    const { isMantecaSupportedCountry } = useIdentityVerification()

    const handleRedirect = (isSuccess: boolean = false) => {
        const redirectUrl = getRedirectUrl()
        if (redirectUrl) {
            clearRedirectUrl()
            router.push(redirectUrl)
        } else if (isSuccess) {
            router.push('/profile')
        } else {
            router.back()
        }
    }

    const handleBridgeKycSuccess = useCallback(async () => {
        await fetchUser()
        handleRedirect(true)
    }, [])

    const {
        iframeOptions,
        handleInitiateKyc,
        isVerificationProgressModalOpen,
        handleIframeClose,
        closeVerificationProgressModal,
        error: kycError,
        isLoading: isKycLoading,
    } = useBridgeKycFlow({
        onKycSuccess: handleBridgeKycSuccess,
    })

    const initialUserDetails: Partial<UserDetailsFormData> = useMemo(
        () => ({
            fullName: user?.user.fullName ?? '',
            email: user?.user.email ?? '',
        }),
        [user]
    )

    const handleUserDetailsSubmit = useCallback(
        async (data: UserDetailsFormData) => {
            setIsUpdatingUser(true)
            setUserUpdateError(null)
            try {
                if (!user?.user.userId) throw new Error('User not found')
                const result = await updateUserById({
                    userId: user.user.userId,
                    fullName: data.fullName,
                    email: data.email,
                })
                if (result.error) {
                    throw new Error(result.error)
                }
                await fetchUser()
                await handleInitiateKyc()
            } catch (error: any) {
                setUserUpdateError(error.message)
                return { error: error.message }
            } finally {
                setIsUpdatingUser(false)
            }
            return {}
        },
        [user]
    )

    const handleBack = useCallback(() => {
        if (showUserDetailsForm) {
            setShowUserDetailsForm(false)
        } else {
            handleRedirect()
        }
    }, [showUserDetailsForm])

    // country validation helpers
    const isBridgeSupportedCountry = (code: string) => {
        const upper = code.toUpperCase()
        return (
            upper === 'US' ||
            upper === 'MX' ||
            Object.keys(BRIDGE_ALPHA3_TO_ALPHA2).includes(upper) ||
            Object.values(BRIDGE_ALPHA3_TO_ALPHA2).includes(upper)
        )
    }

    // Skip country selection if coming from a supported bridge country
    useEffect(() => {
        if (countryParam) {
            if (isBridgeSupportedCountry(countryParam) || countryParam === 'bridge') {
                const country = countryData.find((country) => country.id.toUpperCase() === countryParam.toUpperCase())

                if (country) {
                    setUserClickedCountry({ title: country.title, id: country.id })
                    setIsStartVerificationModalOpen(true)
                } else {
                    // set as bridge
                    setUserClickedCountry({ title: 'Bridge', id: 'bridge' })
                    setIsStartVerificationModalOpen(true)
                }
            }
        }
    }, [countryParam])

    const selectedCountryParams = useMemo(() => {
        if (countryParam) {
            const country = countryData.find((country) => country.id.toUpperCase() === countryParam.toUpperCase())
            if (country) {
                return country
            } else {
                return { title: 'Bridge', id: 'bridge' }
            }
        }
        return null
    }, [countryParam])

    return (
        <div className="flex min-h-[inherit] flex-col space-y-8">
            <NavHeader title="Identity Verification" onPrev={handleBack} />

            {showUserDetailsForm ? (
                <div className="my-auto pt-[25%]">
                    <h1 className="mb-3 font-bold">Provide information to begin verification</h1>

                    <UserDetailsForm
                        ref={formRef}
                        onSubmit={handleUserDetailsSubmit}
                        isSubmitting={isUpdatingUser}
                        onValidChange={setIsUserDetailsFormValid}
                        initialData={initialUserDetails}
                    />

                    <Button
                        onClick={() => formRef.current?.handleSubmit()}
                        loading={isUpdatingUser || isKycLoading}
                        variant="purple"
                        shadowSize="4"
                        className="mt-3 w-full"
                        disabled={!isUserDetailsFormValid || isUpdatingUser || isKycLoading}
                        icon="check-circle"
                    >
                        Verify now
                    </Button>

                    <PeanutDoesntStoreAnyPersonalInformation className="mt-3 w-full justify-center" />

                    {(userUpdateError || kycError) && <ErrorAlert description={userUpdateError ?? kycError ?? ''} />}

                    <IframeWrapper {...iframeOptions} onClose={handleIframeClose} />

                    <KycVerificationInProgressModal
                        isOpen={isVerificationProgressModalOpen}
                        onClose={() => {
                            closeVerificationProgressModal()
                            handleRedirect()
                        }}
                    />
                </div>
            ) : (
                <div className="my-auto">
                    <CountryList
                        inputTitle="Which country issued your ID?"
                        inputDescription="Select a country where you have a valid ID to verify."
                        viewMode="general-verification"
                        onCountryClick={(country) => {
                            const { id, title } = country
                            setUserClickedCountry({ id, title })
                            setIsStartVerificationModalOpen(true)
                        }}
                        showLoadingState={false} // we don't want to show loading state when clicking a country, here because there is no async operation when clicking a country
                    />
                </div>
            )}

            {selectedCountry && (
                <MantecaGeoSpecificKycModal
                    isUserBridgeKycApproved={isUserBridgeKycApproved}
                    selectedCountry={selectedCountry}
                    setIsMantecaModalOpen={setIsMantecaModalOpen}
                    isMantecaModalOpen={isMantecaModalOpen}
                    onKycSuccess={() => handleRedirect(true)}
                />
            )}

            {userClickedCountry && selectedCountryParams && (
                <StartVerificationModal
                    visible={isStartVerificationModalOpen}
                    onClose={() => {
                        // we dont show ID issuer country list for bridge countries
                        if (
                            isBridgeSupportedCountry(selectedCountryParams.id) ||
                            selectedCountryParams.id === 'bridge'
                        ) {
                            handleRedirect()
                        } else {
                            setIsStartVerificationModalOpen(false)
                        }
                    }}
                    onStartVerification={() => {
                        setIsStartVerificationModalOpen(false)
                        if (isMantecaSupportedCountry(userClickedCountry.id)) {
                            setSelectedCountry(userClickedCountry)
                            setIsMantecaModalOpen(true)
                        } else {
                            setShowUserDetailsForm(true)
                        }
                    }}
                    selectedIdentityCountry={userClickedCountry}
                    selectedCountry={selectedCountryParams}
                />
            )}
        </div>
    )
}

export default IdentityVerificationView
