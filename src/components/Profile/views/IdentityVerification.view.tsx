'use client'
import { updateUserById } from '@/app/actions/users'
import { Button } from '@/components/0_Bruddle'
import { UserDetailsForm, UserDetailsFormData } from '@/components/AddMoney/UserDetailsForm'
import ErrorAlert from '@/components/Global/ErrorAlert'
import IframeWrapper from '@/components/Global/IframeWrapper'
import NavHeader from '@/components/Global/NavHeader'
import { KycVerificationInProgressModal } from '@/components/Kyc/KycVerificationInProgressModal'
import { useAuth } from '@/context/authContext'
import { useKycFlow } from '@/hooks/useKycFlow'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

const IdentityVerificationView = () => {
    const { user, fetchUser } = useAuth()
    const router = useRouter()
    const formRef = useRef<{ handleSubmit: () => void }>(null)
    const [isUserDetailsFormValid, setIsUserDetailsFormValid] = useState(false)
    const [isUpdatingUser, setIsUpdatingUser] = useState(false)
    const [userUpdateError, setUserUpdateError] = useState<string | null>(null)
    const {
        iframeOptions,
        handleInitiateKyc,
        handleIframeClose,
        isVerificationProgressModalOpen,
        closeVerificationProgressModal,
        error: kycError,
        isLoading: isKycLoading,
    } = useKycFlow()

    const [firstName, ...lastNameParts] = (user?.user.fullName ?? '').split(' ')
    const lastName = lastNameParts.join(' ')

    const initialUserDetails: Partial<UserDetailsFormData> = useMemo(
        () => ({
            fullName: user?.user.fullName ?? '',
            email: user?.user.email ?? '',
        }),
        [user?.user.fullName, user?.user.email, firstName, lastName]
    )

    const handleUserDetailsSubmit = async (data: UserDetailsFormData) => {
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
            // setStep('kyc')
            await handleInitiateKyc()
        } catch (error: any) {
            setUserUpdateError(error.message)
            return { error: error.message }
        } finally {
            setIsUpdatingUser(false)
        }
        return {}
    }

    // if kyc is already approved, redirect to profile
    useEffect(() => {
        if (user?.user.bridgeKycStatus === 'approved') {
            router.replace('/profile')
        }
    }, [user])

    return (
        <div className="flex min-h-[inherit] flex-col">
            <NavHeader title="Identity Verification" onPrev={() => router.replace('/profile')} />
            <div className="my-auto">
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

                {(userUpdateError || kycError) && <ErrorAlert description={userUpdateError ?? kycError ?? ''} />}

                <IframeWrapper {...iframeOptions} onClose={handleIframeClose} />

                <KycVerificationInProgressModal
                    isOpen={isVerificationProgressModalOpen}
                    onClose={closeVerificationProgressModal}
                />
            </div>
        </div>
    )
}

export default IdentityVerificationView
