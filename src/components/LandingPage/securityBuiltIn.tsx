import React from 'react'
import Image from 'next/image'
import handThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'
import handWaving from '@/assets/illustrations/hand-waving.svg'
import handPeace from '@/assets/illustrations/hand-peace.svg'
import securityPrivacyBuiltIn from '@/assets/illustrations/security-privacy-built-in.svg'
import mobileSecurityPrivacyBuiltIn from '@/assets/illustrations/mobile-security-privacy-built-in.svg'
import biometricProtection from '@/assets/illustrations/biometric-protection.svg'
import selfCustodialDesign from '@/assets/illustrations/self-custodial-design.svg'
import kycOnlyWhenRequired from '@/assets/illustrations/kyc-only-when-required.svg'

interface Feature {
    id: number
    title: string
    titleSvg: any
    description: string
    iconSrc: any
    iconAlt: string
}

const features: Feature[] = [
    {
        id: 1,
        title: 'BIOMETRIC PROTECTION',
        titleSvg: biometricProtection,
        description: 'Verify with Face ID, Touch ID or passcode, every single action is yours to approve.',
        iconSrc: handThumbsUp,
        iconAlt: 'Thumbs up',
    },
    {
        id: 2,
        title: 'SELF-CUSTODIAL BY DESIGN',
        titleSvg: selfCustodialDesign,
        description: "Peanut is fully self-custodial. Your assets can't be frozen or moved by anyone else.",
        iconSrc: handWaving,
        iconAlt: 'Hand waving',
    },
    {
        id: 3,
        title: 'KYC ONLY WHEN REQUIRED',
        titleSvg: kycOnlyWhenRequired,
        description: 'No mandatory hoops, verify your identity only if you actually need the feature.',
        iconSrc: handPeace,
        iconAlt: 'Peace sign',
    },
]

export function SecurityBuiltIn() {
    return (
        <section className="bg-primary-1 px-4 py-16 text-n-1 md:py-40">
            <div className="mx-auto max-w-7xl">
                <div className="mb-12 text-center md:mb-16 md:text-left">
                    {/* Mobile version */}
                    <Image
                        src={mobileSecurityPrivacyBuiltIn}
                        alt="Security & Privacy, Built-In"
                        width={800}
                        height={150}
                        className="mx-auto block h-auto w-[90%] md:hidden"
                    />
                    {/* Desktop version */}
                    <Image
                        src={securityPrivacyBuiltIn}
                        alt="Security & Privacy, Built-In"
                        width={800}
                        height={150}
                        className="mx-auto hidden h-auto w-full max-w-md md:mx-0 md:block md:max-w-4xl"
                    />
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    {features.map((feature) => (
                        <div
                            key={feature.id}
                            className="my-2 flex flex-col items-start text-center md:my-0 md:text-left"
                        >
                            <div className="mb-4">
                                <div className="flex h-10 w-10 items-center justify-center md:h-12 md:w-12">
                                    <Image
                                        src={feature.iconSrc}
                                        alt={feature.iconAlt}
                                        width={40}
                                        height={40}
                                        className="max-h-full max-w-full object-contain md:h-12 md:w-12"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="mb-4 w-full max-w-sm text-left md:text-left">
                                    <Image
                                        src={feature.titleSvg}
                                        alt={feature.title}
                                        width={300}
                                        height={60}
                                        className="h-auto w-full max-w-[260px] md:mx-0 md:max-w-sm"
                                    />
                                </div>
                                <p
                                    className="w-full max-w-[360px] text-left font-roboto text-lg font-normal leading-relaxed md:text-lg"
                                    style={{ letterSpacing: '-0.5px' }}
                                >
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
