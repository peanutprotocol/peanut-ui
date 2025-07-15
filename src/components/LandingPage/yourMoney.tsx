import React from 'react'
import Image from 'next/image'
import iphoneYourMoney1 from '@/assets/iphone-ss/iphone-your-money-1.png'
import iphoneYourMoney2 from '@/assets/iphone-ss/iphone-your-money-2.png'
import iphoneYourMoney3 from '@/assets/iphone-ss/iphone-your-money-3.png'
import yourMoneyAnywhere from '@/assets/illustrations/your-money-anywhere.svg'
import mobileYourMoneyAnywhere from '@/assets/illustrations/mobile-your-money-anywhere.svg'
import freeGlobalTransfers from '@/assets/illustrations/free-global-transfers.svg'
import payAnyoneAnywhere from '@/assets/illustrations/pay-anyone-anywhere.svg'
import getPaidWorldwide from '@/assets/illustrations/get-paid-worldwide.svg'

interface Feature {
    id: number
    title: string
    titleSvg: any
    description: string
    imageSrc: any
    imageAlt: string
}

const features: Feature[] = [
    {
        id: 1,
        title: 'FREE GLOBAL TRANSFERS',
        titleSvg: freeGlobalTransfers,
        description:
            'Move money between your own accounts in 140+ countries and 50+ currencies, no fees, live FX rates.',
        imageSrc: iphoneYourMoney1,
        imageAlt: 'iPhone showing global transfer screen',
    },
    {
        id: 2,
        title: 'PAY ANYONE, ANYWHERE',
        titleSvg: payAnyoneAnywhere,
        description:
            'Send funds in seconds through WhatsApp, a phone number, or a QR code. No bank details, no friction.',
        imageSrc: iphoneYourMoney2,
        imageAlt: 'iPhone showing payment options screen',
    },
    {
        id: 3,
        title: 'GET PAID WORLDWIDE',
        titleSvg: getPaidWorldwide,
        description:
            'Get paid by clients in 140+ countries, direct to your account, and settle in the currency you prefer.',
        imageSrc: iphoneYourMoney3,
        imageAlt: 'iPhone showing payment request screen',
    },
]

export function YourMoney() {
    return (
        <section className="bg-secondary-1 px-4 py-12 text-n-1 md:py-16">
            <div className="mx-auto max-w-7xl">
                <div className="mb-12 mt-4 text-center md:mb-20 md:mt-6 md:text-left">
                    {/* Mobile version */}
                    <Image
                        src={mobileYourMoneyAnywhere}
                        alt="Your Money, Anywhere"
                        width={800}
                        height={150}
                        className="mx-auto h-auto w-full block md:hidden"
                    />
                    {/* Desktop version */}
                    <Image
                        src={yourMoneyAnywhere}
                        alt="Your Money, Anywhere"
                        width={800}
                        height={150}
                        className="mx-auto h-auto w-3/4 max-w-sm md:mx-0 md:max-w-4xl hidden md:block"
                    />
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    {features.map((feature, index) => (
                        <div key={feature.id} className="flex flex-col items-center my-2 md:my-0">
                            <div className="mb-4 flex w-full max-w-xs justify-center md:mb-6">
                                <Image
                                    src={feature.imageSrc}
                                    alt={feature.imageAlt}
                                    width={240}
                                    height={480}
                                    className="h-auto max-w-[180px] object-contain md:max-w-[240px]"
                                />
                            </div>
                            <div>
                                <div className={`${index === 1 ? 'mb-3' : 'mb-4'} w-full max-w-sm text-left md:text-left`}>
                                    <Image
                                        src={feature.titleSvg}
                                        alt={feature.title}
                                        width={300}
                                        height={60}
                                        className="h-auto w-full max-w-[240px] md:mx-0 md:max-w-sm"
                                    />
                                </div>
                                <p className="w-full max-w-[360px] text-left font-roboto text-lg font-normal leading-relaxed md:text-lg" style={{ letterSpacing: '-0.5px' }}>
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
