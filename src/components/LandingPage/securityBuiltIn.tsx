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
        title: 'TOTAL SECURITY',
        titleSvg: biometricProtection,
        description:
            'Peanut is 100 % self-custodial. Every transaction is approved via Passkeys using Face ID, Touch ID or passcode. No one else can move your assets.',
        iconSrc: handThumbsUp,
        iconAlt: 'Thumbs up',
    },
    {
        id: 2,
        title: 'TRUE CONTROL',
        titleSvg: selfCustodialDesign,
        description:
            'You verify your identity only when a feature truly requires it. The rest of the time you operate without mandatory KYC or friction.',
        iconSrc: handWaving,
        iconAlt: 'Hand waving',
    },
    {
        id: 3,
        title: '24/7 HELP',
        titleSvg: kycOnlyWhenRequired,
        description:
            'One tap connects you to real humans. Friendly, expert support is on hand day or night to resolve any question instantly.',
        iconSrc: handPeace,
        iconAlt: 'Peace sign',
    },
]

export function SecurityBuiltIn() {
    return (
        <section className="bg-primary-1 px-4 py-16 text-n-1 md:py-40">
            <div className="mx-auto max-w-7xl">
                <div className="mb-12 text-center md:mb-16 md:text-left">
                    <h1 className="font-roboto-flex-extrabold text-left text-heading font-extraBlack md:text-6xl lg:text-heading">
                        SECURITY. CONTROL. SUPPORT.
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
                                    className="font-roboto-flex w-full max-w-[360px] text-left font-roboto text-lg font-normal leading-relaxed md:text-xl"
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
