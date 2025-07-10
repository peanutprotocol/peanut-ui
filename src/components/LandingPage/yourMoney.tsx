import React from 'react'
import Image from 'next/image'
import iphoneYourMoney1 from '@/assets/iphone-ss/iphone-your-money-1.png'
import iphoneYourMoney2 from '@/assets/iphone-ss/iphone-your-money-2.svg'
import iphoneYourMoney3 from '@/assets/iphone-ss/iphone-your-money-3.png'

interface Feature {
    id: number
    title: string
    description: string
    imageSrc: any
    imageAlt: string
}

const features: Feature[] = [
    {
        id: 1,
        title: 'FREE GLOBAL TRANSFERS',
        description:
            'Move money between your own accounts in 140+ countries and 45+ currencies, no fees, live FX rates.',
        imageSrc: iphoneYourMoney1,
        imageAlt: 'iPhone showing global transfer screen',
    },
    {
        id: 2,
        title: 'PAY ANYONE, ANYWHERE',
        description:
            'Send funds in seconds through WhatsApp, a phone number, or a QR code. No bank details, no friction.',
        imageSrc: iphoneYourMoney2,
        imageAlt: 'iPhone showing payment options screen',
    },
    {
        id: 3,
        title: 'GET PAID WORLDWIDE',
        description:
            'Get paid by clients in 140+ countries, direct to your account, and settle in the currency you prefer.',
        imageSrc: iphoneYourMoney3,
        imageAlt: 'iPhone showing payment request screen',
    },
]

export function YourMoney() {
    return (
        <section className="bg-secondary-1 px-4 py-16 text-n-1">
            <div className="mx-auto max-w-7xl">
                <h2 className="mb-20 mt-6 text-left font-roboto text-4xl md:text-[4.5rem]" style={{ fontWeight: 900 }}>
                    YOUR MONEY, ANYWHERE
                </h2>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    {features.map((feature) => (
                        <div key={feature.id} className="flex flex-col items-center">
                            <div className="mb-6 flex w-full max-w-xs justify-center">
                                <Image
                                    src={feature.imageSrc}
                                    alt={feature.imageAlt}
                                    width={240}
                                    height={480}
                                    className="h-auto max-w-[240px] object-contain"
                                />
                            </div>
                            <div>
                                <h3
                                    className="mb-2 w-full max-w-sm text-left font-roboto text-3xl"
                                    style={{ fontWeight: 900 }}
                                >
                                    {feature.title}
                                </h3>
                                <p className="w-full max-w-[360px] text-left font-roboto text-lg font-semibold leading-relaxed">
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
