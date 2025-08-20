import iphoneYourMoney1 from '@/assets/iphone-ss/iphone-your-money-1.png'
import iphoneYourMoney2 from '@/assets/iphone-ss/iphone-your-money-2.png'
import iphoneYourMoney3 from '@/assets/iphone-ss/iphone-your-money-3.png'
import freeGlobalTransfers from '@/assets/illustrations/free-global-transfers.svg'
import payAnyoneAnywhere from '@/assets/illustrations/pay-anyone-anywhere.svg'
import getPaidWorldwide from '@/assets/illustrations/get-paid-worldwide.svg'

import { Button } from '../0_Bruddle'

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
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-7 md:flex-row">
                <div className="mb-12 mt-4 w-full space-y-6 text-center md:mb-20 md:mt-6 md:w-1/2 md:text-left">
                    <h1 className="font-roboto-flex-extrabold text-6xl font-extraBlack md:text-6xl lg:text-headingMedium">
                        YOUR MONEY,
                        <br /> ANYWHERE
                    </h1>

                    <h2 className="font-roboto-flex text-lg md:text-4xl md:font-medium">
                        140+ countries · 50+ currencies · 0% fees
                    </h2>

                    <p className="font-roboto-flex text-left text-xl font-light md:text-4xl md:font-normal">
                        Peanut turns the entire planet into one seamless wallet, moving funds in real time across the
                        world with zero hidden spreads or hoops to jump through.
                    </p>
                </div>

                <div className="relative w-full md:w-1/2">
                    <video src="/currencies.webm" autoPlay loop muted playsInline className="h-auto w-full" />
                    <a
                        href="/setup"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <Button
                            shadowSize="4"
                            className="h-10 w-28 bg-white py-0 text-sm font-extrabold hover:bg-white/90 md:w-40 md:py-6 md:text-lg"
                        >
                            TRY NOW
                        </Button>
                    </a>
                </div>
            </div>
        </section>
    )
}
