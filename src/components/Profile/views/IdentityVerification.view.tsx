'use client'
import { updateUserById } from '@/app/actions/users'
import { Button } from '@/components/0_Bruddle'
import { countryCodeMap, MantecaSupportedExchanges } from '@/components/AddMoney/consts'
import { UserDetailsForm, UserDetailsFormData } from '@/components/AddMoney/UserDetailsForm'
import { CountryList } from '@/components/Common/CountryList'
import ErrorAlert from '@/components/Global/ErrorAlert'
import IframeWrapper from '@/components/Global/IframeWrapper'
import NavHeader from '@/components/Global/NavHeader'
import ActionModal from '@/components/Global/ActionModal'
import {
    KycVerificationInProgressModal,
    PeanutDoesntStoreAnyPersonalInformation,
} from '@/components/Kyc/KycVerificationInProgressModal'
import { MantecaGeoSpecificKycModal } from '@/components/Kyc/InitiateMantecaKYCModal'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { useBridgeKycFlow } from '@/hooks/useBridgeKycFlow'
import { MantecaKycStatus } from '@/interfaces'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useRef, useState } from 'react'
import useKycStatus from '@/hooks/useKycStatus'
import { getRedirectUrl, clearRedirectUrl } from '@/utils/general.utils'

const IdentityVerificationView = () => {
    const router = useRouter()
    const formRef = useRef<{ handleSubmit: () => void }>(null)
    const [isUserDetailsFormValid, setIsUserDetailsFormValid] = useState(false)
    const [isUpdatingUser, setIsUpdatingUser] = useState(false)
    const [userUpdateError, setUserUpdateError] = useState<string | null>(null)
    const [showUserDetailsForm, setShowUserDetailsForm] = useState(false)
    const [isAlreadyVerifiedModalOpen, setIsAlreadyVerifiedModalOpen] = useState(false)
    const [isMantecaModalOpen, setIsMantecaModalOpen] = useState(false)
    const [selectedCountry, setSelectedCountry] = useState<{ id: string; title: string } | null>(null)
    const [userClickedCountry, setUserClickedCountry] = useState<{ id: string; title: string } | null>(null)
    const { isUserBridgeKycApproved } = useKycStatus()
    const { user, fetchUser } = useAuth()

    const handleRedirect = () => {
        const redirectUrl = getRedirectUrl()
        if (redirectUrl) {
            clearRedirectUrl()
            router.push(redirectUrl)
        } else {
            router.replace('/profile')
        }
    }

    const {
        iframeOptions,
        handleInitiateKyc,
        isVerificationProgressModalOpen,
        closeVerificationProgressModal,
        error: kycError,
        isLoading: isKycLoading,
    } = useBridgeKycFlow({
        onKycSuccess: async () => {
            await fetchUser()
            handleRedirect()
        },
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
            Object.keys(countryCodeMap).includes(upper) ||
            Object.values(countryCodeMap).includes(upper)
        )
    }

    const isMantecaSupportedCountry = (code: string) => {
        const upper = code.toUpperCase()
        return Object.prototype.hasOwnProperty.call(MantecaSupportedExchanges, upper)
    }

    const isVerifiedForCountry = useCallback(
        (code: string) => {
            const upper = code.toUpperCase()
            // bridge approval covers us/mx/sepa generally
            if (isBridgeSupportedCountry(upper) && isUserBridgeKycApproved) return true
            // manteca per-geo check
            const mantecaActive = user?.user.kycVerifications?.some(
                (v) =>
                    v.provider === 'MANTECA' &&
                    (v.mantecaGeo || '').toUpperCase() === upper &&
                    v.status === MantecaKycStatus.ACTIVE
            )
            return Boolean(mantecaActive)
        },
        [user]
    )

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

                    <IframeWrapper {...iframeOptions} onClose={handleRedirect} />

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
                        inputTitle="Select your region."
                        viewMode="general-verification"
                        getRightContent={(country) =>
                            isVerifiedForCountry(country.id) ? (
                                <Icon name="check" className="size-4 text-success-3" />
                            ) : undefined
                        }
                        onCountryClick={(country) => {
                            const { id, title } = country
                            setUserClickedCountry({ id, title })

                            if (isVerifiedForCountry(id)) {
                                setIsAlreadyVerifiedModalOpen(true)
                                return
                            }

                            if (isBridgeSupportedCountry(id)) {
                                setShowUserDetailsForm(true)
                                return
                            }

                            if (isMantecaSupportedCountry(id)) {
                                setSelectedCountry({ id, title })
                                setIsMantecaModalOpen(true)
                            }
                        }}
                    />
                </div>
            )}

            <ActionModal
                visible={isAlreadyVerifiedModalOpen}
                onClose={() => setIsAlreadyVerifiedModalOpen(false)}
                title="You're already verified"
                description={
                    <p>
                        Your identity has already been successfully verified for {userClickedCountry?.title}. You can
                        continue to use features available in this region. No further action is needed.
                    </p>
                }
                icon="shield"
                ctas={[
                    {
                        text: 'Close',
                        shadowSize: '4',
                        className: 'md:py-2',
                        onClick: () => {
                            setIsAlreadyVerifiedModalOpen(false)
                            handleRedirect()
                        },
                    },
                ]}
            />

            {selectedCountry && (
                <MantecaGeoSpecificKycModal
                    isUserBridgeKycApproved={isUserBridgeKycApproved}
                    selectedCountry={selectedCountry}
                    setIsMantecaModalOpen={setIsMantecaModalOpen}
                    isMantecaModalOpen={isMantecaModalOpen}
                    onKycSuccess={handleRedirect}
                />
            )}
        </div>
    )
}

export default IdentityVerificationView
