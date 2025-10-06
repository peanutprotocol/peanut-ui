import Image from 'next/image'
import { LandingCountries } from '@/assets'
import { Button } from '../0_Bruddle'

export function YourMoney() {
    return (
        <section className="bg-secondary-1 px-4 py-12 text-n-1 md:py-16">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-7 md:flex-row">
                <div className="mb-12 mt-4 w-full space-y-6 text-center md:mb-20 md:mt-6 md:w-1/2 md:text-left">
                    <h1 className="font-roboto-flex-extrabold text-6xl font-extraBlack md:text-6xl lg:text-headingMedium">
                        GLOBAL CASH.
                        <br /> LOCAL FEEL
                    </h1>

                    <h2 className="font-roboto-flex text-lg md:text-4xl md:font-medium">
                        140+ countries · 50+ currencies · 0% fees
                    </h2>

                    <p className="font-roboto-flex text-left text-xl font-light md:text-4xl md:font-normal">
                        From New York to Madrid to Mexico City — send and share instantly.
                    </p>
                </div>

                <div className="relative w-full md:w-1/2">
                    <Image src={LandingCountries} alt="countries" />
                    <a
                        href="/setup"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <Button
                            shadowSize="4"
                            className="h-10 w-38 bg-white py-0 text-sm font-extrabold hover:bg-white/90 md:w-40 md:py-6 md:text-lg"
                        >
                            JOIN WAITLIST
                        </Button>
                    </a>
                </div>
            </div>
        </section>
    )
}
