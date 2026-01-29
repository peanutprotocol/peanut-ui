'use client'

import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import { Icon } from '@/components/Global/Icons/Icon'
import Card from '@/components/Global/Card'
import { useRouter } from 'next/navigation'
import { saveRedirectUrl } from '@/utils/general.utils'

interface CardGeoScreenProps {
    isEligible: boolean
    eligibilityReason?: string
    onContinue: () => void
    onBack: () => void
}

const CardGeoScreen = ({ isEligible, eligibilityReason, onContinue, onBack }: CardGeoScreenProps) => {
    const router = useRouter()

    // Check if the reason indicates missing KYC (no country data)
    // Only show verification prompt if they truly have NO KYC data
    const needsKycVerification =
        !isEligible &&
        (eligibilityReason?.toLowerCase().includes('country information not available') ||
            eligibilityReason?.toLowerCase().includes('please complete kyc'))

    const handleStartVerification = () => {
        // Save current URL so user returns here after KYC
        saveRedirectUrl()
        // Go directly to Bridge KYC (covers Europe, North America, Mexico + QR in AR/BR)
        // This skips region/country selection and gets user verified faster
        router.push('/profile/identity-verification/europe/bridge')
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="Eligibility" onPrev={onBack} />

            <div className="flex flex-col gap-6">
                {isEligible ? (
                    <>
                        {/* Eligible State */}
                        <Card className="flex flex-col items-center gap-4 p-6">
                            <div className="flex size-16 items-center justify-center rounded-full bg-success-1">
                                <Icon name="check" size={32} />
                            </div>
                            <div className="text-center">
                                <h2 className="text-xl font-bold">You're Eligible!</h2>
                                <p className="mt-2 text-sm text-grey-1">
                                    Great news! Card Pioneers is available in your region. Continue to see how the
                                    program works.
                                </p>
                            </div>
                        </Card>
                    </>
                ) : needsKycVerification ? (
                    <>
                        {/* Needs KYC Verification State */}
                        <Card className="flex flex-col items-center gap-4 p-6">
                            <div className="flex size-16 items-center justify-center rounded-full bg-primary-1">
                                <Icon name="shield" size={32} />
                            </div>
                            <div className="text-center">
                                <h1 className="text-2xl font-bold">Verification Required</h1>
                                <p className="mt-2 text-sm text-grey-1">
                                    Complete identity verification to check your eligibility for Card Pioneers.
                                </p>
                            </div>
                        </Card>

                        <div className="flex items-center gap-2">
                            <Icon name="info" className="size-4 flex-shrink-0 text-grey-1" />
                            <p className="text-sm text-grey-1">
                                Verification helps us determine your region and unlock features like QR payments.
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Not Eligible State */}
                        <Card className="flex flex-col items-center gap-4 p-6">
                            <div className="flex size-16 items-center justify-center rounded-full bg-yellow-1">
                                <Icon name="globe-lock" size={32} />
                            </div>
                            <div className="text-center">
                                <h1 className="text-2xl font-bold">Not Available Yet</h1>
                                <p className="mt-2 text-sm text-grey-1">
                                    Card Pioneers isn't available in your region yet. We're working hard to expand
                                    coverage.
                                </p>
                            </div>
                        </Card>

                        <div className="flex items-center gap-2">
                            <Icon name="info" className="size-4 flex-shrink-0 text-grey-1" />
                            <p className="text-sm text-grey-1">
                                We'll notify you when we launch in your area. In the meantime, keep using Peanut to earn
                                points!
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* CTA Buttons */}
            <div className="mt-auto space-y-3">
                {isEligible ? (
                    <Button variant="purple" size="large" shadowSize="4" onClick={onContinue} className="w-full">
                        Continue
                    </Button>
                ) : needsKycVerification ? (
                    <>
                        <Button
                            variant="purple"
                            size="large"
                            shadowSize="4"
                            onClick={handleStartVerification}
                            className="w-full"
                        >
                            Start Verification
                        </Button>
                        <Button variant="stroke" onClick={onBack} className="w-full">
                            Maybe Later
                        </Button>
                    </>
                ) : (
                    <Button variant="stroke" onClick={onBack} className="w-full">
                        Go Back
                    </Button>
                )}
            </div>
        </div>
    )
}

export default CardGeoScreen
