'use client'

import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import { Icon } from '@/components/Global/Icons/Icon'
import Card from '@/components/Global/Card'
import InfoCard from '@/components/Global/InfoCard'
import { useRouter } from 'next/navigation'
import { saveRedirectUrl } from '@/utils/general.utils'

interface CardGeoScreenProps {
    isEligible: boolean
    eligibilityReason?: string
    onContinue: () => void
    onInitiatePurchase: () => void
    onBack: () => void
    purchaseError?: string | null
}

const CardGeoScreen = ({
    isEligible,
    eligibilityReason,
    onContinue,
    onInitiatePurchase,
    onBack,
    purchaseError,
}: CardGeoScreenProps) => {
    const router = useRouter()

    // State 3: KYC approved but couldn't fetch country - show warning but allow proceeding
    const hasKycButNoCountry = !isEligible && eligibilityReason === 'KYC_APPROVED_NO_COUNTRY'

    // State 1 & 2: No KYC or KYC in progress - show verification prompt
    // TODO: Replace string matching with structured eligibility codes from backend (e.g., NEEDS_KYC, KYC_IN_PROGRESS)
    const needsKycVerification =
        !isEligible &&
        !hasKycButNoCountry &&
        (eligibilityReason?.toLowerCase().includes('country information not available') ||
            eligibilityReason?.toLowerCase().includes('please complete kyc'))

    const handleStartVerification = () => {
        saveRedirectUrl()
        // TODO: Path says "europe" but Bridge covers all regions - consider renaming route or using generic path
        router.push('/profile/identity-verification/europe/bridge')
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title="Eligibility" onPrev={onBack} />

            <div className="my-auto flex flex-col gap-6">
                {isEligible ? (
                    <>
                        {/* Eligible State */}
                        <Card className="flex flex-col items-center gap-4 p-6">
                            <div className="flex size-8 items-center justify-center rounded-full bg-success-1">
                                <Icon name="check" size={16} />
                            </div>
                            <div className="text-center">
                                <h2 className="font-bold">You're Eligible!</h2>
                                <p className="mt-2 text-sm text-black">
                                    Great news! Card Pioneers is available in your region. Continue to see how the
                                    program works.
                                </p>
                            </div>
                        </Card>
                    </>
                ) : hasKycButNoCountry ? (
                    <>
                        {/* State 3: KYC approved but couldn't fetch country - show warning but allow proceeding */}
                        <Card className="flex flex-col items-center gap-4 p-6">
                            <div className="flex size-8 items-center justify-center rounded-full bg-success-1">
                                <Icon name="check" size={16} />
                            </div>
                            <div className="text-center">
                                <h2 className="font-bold">Verification Complete</h2>
                                <p className="mt-2 text-sm text-black">
                                    Your identity has been verified. You can proceed with your card reservation.
                                </p>
                            </div>
                        </Card>

                        {/* Warning banner - country data not synced yet */}
                        <InfoCard
                            variant="warning"
                            icon="alert"
                            description="We're still syncing your location data. If you're in an eligible region, you'll be able to complete your purchase."
                        />
                    </>
                ) : needsKycVerification ? (
                    <>
                        {/* Needs KYC Verification State */}
                        <Card className="flex flex-col items-center gap-4 p-6">
                            <div className="flex size-8 items-center justify-center rounded-full bg-primary-1">
                                <Icon name="shield" size={16} />
                            </div>
                            <div className="text-center">
                                <h1 className="font-bold">Verification Required</h1>
                                <p className="mt-2 text-sm text-black">Card Purchase requires identity verification.</p>
                            </div>
                        </Card>

                        {/* <div className="flex items-center gap-2">
                            <Icon name="info" className="size-4 flex-shrink-0" />
                            <p className="text-sm">Verification helps us determine your region eligibility.</p>
                        </div> */}
                    </>
                ) : (
                    <>
                        {/* Not Eligible State */}
                        <Card className="flex flex-col items-center gap-4 p-6">
                            <div className="flex size-8 items-center justify-center rounded-full bg-yellow-1">
                                <Icon name="globe-lock" size={16} />
                            </div>
                            <div className="text-center">
                                <h1 className="font-bold">Not Available Yet</h1>
                                <p className="mt-2 text-sm text-black">
                                    Card Pioneers isn't available in your region yet. We're working hard to expand
                                    coverage.
                                </p>
                            </div>
                        </Card>

                        <div className="flex items-center gap-2">
                            <Icon name="info" className="size-4 flex-shrink-0" />
                            <p className="text-sm">
                                We'll notify you when we launch in your area. In the meantime, keep using Peanut to earn
                                points!
                            </p>
                        </div>
                    </>
                )}

                {purchaseError && <InfoCard variant="error" icon="alert" description={purchaseError} />}

                {/* CTA Buttons */}
                {isEligible || hasKycButNoCountry ? (
                    <Button variant="purple" shadowSize="4" onClick={onInitiatePurchase} className="w-full">
                        Reserve my card
                    </Button>
                ) : needsKycVerification ? (
                    <Button variant="purple" shadowSize="4" onClick={handleStartVerification} className="w-full">
                        Start Verification
                    </Button>
                ) : (
                    <Button variant="stroke" shadowSize="4" onClick={onBack} className="w-full">
                        Go Back
                    </Button>
                )}
            </div>
        </div>
    )
}

export default CardGeoScreen
