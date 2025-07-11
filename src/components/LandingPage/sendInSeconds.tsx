import React from 'react'
import Image from 'next/image'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import exclamations from '@/assets/illustrations/exclamations.svg'
import { Star } from '@/assets'

export function SendInSeconds() {
    return (
        <section className="relative overflow-hidden bg-secondary-1 px-4 py-32 text-n-1">
            {/* Decorative clouds, stars, and exclamations */}
            {/* Clouds */}
            <Image src={borderCloud} alt="Cloud" width={320} height={160} className="absolute -left-20 top-20" />
            <Image src={borderCloud} alt="Cloud" width={180} height={90} className="absolute bottom-30 left-60" />
            <Image src={borderCloud} alt="Cloud" width={200} height={100} className="absolute right-12 top-60" />
            <Image src={borderCloud} alt="Cloud" width={320} height={160} className="absolute bottom-20 right-20" />

            {/* Stars and exclamations */}
            <Image
                src={Star}
                alt="Star"
                width={50}
                height={50}
                className="absolute right-1/4 top-20"
                style={{ transform: 'rotate(45deg)' }}
            />
            <Image
                src={Star}
                alt="Star"
                width={40}
                height={40}
                className="absolute bottom-16 left-1/3"
                style={{ transform: 'rotate(-10deg)' }}
            />
            <Image
                src={Star}
                alt="Star"
                width={50}
                height={50}
                className="absolute bottom-72 right-[14rem]"
                style={{ transform: 'rotate(-22deg)' }}
            />
            <Image
                src={Star}
                alt="Star"
                width={60}
                height={60}
                className="absolute left-[20rem] top-72"
                style={{ transform: 'rotate(12deg)' }}
            />

            {/* Exclamations */}
            <Image
                src={exclamations}
                alt="Exclamations"
                width={200}
                height={300}
                className="absolute right-72 top-1/3 -translate-y-1/2 transform"
            />

            {/* Main content */}
            <div className="relative mx-auto max-w-3xl text-center">
                <h2
                    className="mb-10 font-roboto text-3xl font-black leading-tight md:text-[4rem]"
                    style={{ fontWeight: 900, lineHeight: '0.9' }}
                >
                    SEND IN SECONDS.
                    <br />
                    <span className="mt-6 inline-block">
                        PAY{' '}
                        <span className="relative inline-block align-middle text-[4rem] md:text-[9rem]">
                            {' '}
                            <span className="relative translate-x-[2px] font-knerd-filled text-white">ZERO</span>
                            <span className="absolute -left-[4px] top-3 font-knerd-outline" style={{ fontWeight: 300 }}>
                                ZERO
                            </span>
                        </span>{' '}
                        FEES.
                    </span>
                    <br />
                    START RIGHT NOW.
                </h2>

                <p className="mb-8 font-roboto text-lg font-black md:text-4xl" style={{ fontWeight: 900 }}>
                    MOVE MONEY WORLDWIDE INSTANTLY AND UNDER YOUR CONTROL.
                </p>

                {/* Button with arrows */}
                <div className="relative inline-block">
                    <a
                        href="/setup"
                        className="mt-20 inline-block rounded-sm border-2 border-n-1 bg-white px-12 py-6 text-center font-roboto text-2xl font-black text-n-1 hover:bg-grey-2 focus:outline-none"
                        style={{ fontWeight: 900 }}
                    >
                        TRY NOW
                    </a>

                    {/* Arrow placeholders */}
                    <Image
                        src="/arrows/small-arrow.svg"
                        alt="Arrow pointing to button"
                        width={64}
                        height={32}
                        className="absolute -left-20 top-1/4 -translate-y-1/2 transform"
                    />
                    <Image
                        src="/arrows/small-arrow.svg"
                        alt="Arrow pointing to button"
                        width={64}
                        height={32}
                        className="absolute -right-20 top-1/4 -translate-y-1/2 scale-x-[-1] transform"
                    />
                </div>
            </div>
        </section>
    )
}
