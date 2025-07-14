import React from 'react'
import Image from 'next/image'
import handThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'
import handWaving from '@/assets/illustrations/hand-waving.svg'
import handPeace from '@/assets/illustrations/hand-peace.svg'

interface Feature {
    id: number
    title: string
    description: string
    iconSrc: any
    iconAlt: string
}

const features: Feature[] = [
    {
        id: 1,
        title: 'BIOMETRIC PROTECTION',
        description: 'Verify with Face ID, Touch ID or passcode, every single action is yours to approve.',
        iconSrc: handThumbsUp,
        iconAlt: 'Thumbs up',
    },
    {
        id: 2,
        title: 'SELF-CUSTODIAL BY DESIGN',
        description: "Peanut is fully self-custodial. Your assets can't be frozen or moved by anyone else.",
        iconSrc: handWaving,
        iconAlt: 'Hand waving',
    },
    {
        id: 3,
        title: 'KYC ONLY WHEN REQUIRED',
        description: 'No mandatory hoops, verify your identity only if you actually need the feature.',
        iconSrc: handPeace,
        iconAlt: 'Peace sign',
    },
]

export function SecurityBuiltIn() {
    return (
        <section className="bg-primary-1 px-4 py-16 text-n-1 md:py-40">
            <div className="mx-auto max-w-7xl">
                <h2
                    className="mb-12 text-center font-roboto text-2xl font-black leading-tight md:mb-16 md:text-left md:text-[4rem]"
                    style={{ fontWeight: 900 }}
                >
                    SECURITY & PRIVACY, BUILT-IN
                </h2>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    {features.map((feature) => (
                        <div
                            key={feature.id}
                            className="flex flex-col items-center text-center md:items-start md:text-left"
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
                            <h3
                                className="mb-2 font-roboto text-lg font-black leading-tight md:text-2xl"
                                style={{ fontWeight: 800 }}
                            >
                                {feature.title}
                            </h3>
                            <p className="max-w-sm font-roboto text-sm font-normal leading-relaxed md:text-base">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
