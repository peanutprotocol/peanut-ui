import React from 'react'
import Image from 'next/image'
import handThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'
import handWaving from '@/assets/illustrations/hand-waving.svg'
import handPeace from '@/assets/illustrations/hand-peace.svg'
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
        title: 'BIOMETRIC AUTHENTICATION',
        titleSvg: biometricProtection,
        description:
            "Peanut uses your phone's secure enclave, a cryptographic hardware designed to securely authenticate your actions and keep your account private and unhackable.",
        iconSrc: handThumbsUp,
        iconAlt: 'Thumbs up',
    },
    {
        id: 2,
        title: 'SELF-CUSTODIAL BY DESIGN',
        titleSvg: selfCustodialDesign,
        description: 'Your assets cannot be frozen by anyone or moved without your consent',
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
                    <h1 className="font-roboto-flex-extrabold text-heading font-extraBlack md:text-6xl lg:text-heading">
                        SECURITY & PRIVACY, BUILT-IN
                    </h1>
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
                                <div className="mb-4 w-full text-left md:text-left">
                                    <h3 className="font-roboto-flex-extrabold text-2xl lg:text-3xl">{feature.title}</h3>
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
