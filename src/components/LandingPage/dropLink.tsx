'use client'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Button } from '../0_Bruddle'
import iphoneDropALink from '@/assets/iphone-ss/iphone-drop-a-link.png'
import iphoneDropALinkMobile from '@/assets/iphone-ss/iphone-drop-a-link-mobile.png'

// Define the background color as a constant
const businessBgColor = '#90A8ED'

export function DropLink() {
    return (
        <section
            className="flex min-h-[500px] items-center justify-center px-4 py-16 text-n-1 md:min-h-[700px]"
            style={{ backgroundColor: businessBgColor }}
        >
            <div className="flex w-[80rem] flex-col items-center justify-center p-6 md:flex-row">
                <div className="w-full space-y-8 md:w-2/3">
                    <h1 className="font-roboto-flex-extrabold text-center text-[4rem] font-extraBlack md:text-left lg:text-headingMedium">
                        JUST DROP A LINK
                    </h1>

                    <Image
                        src={iphoneDropALinkMobile}
                        alt="Drop a link"
                        width={300}
                        height={300}
                        className="mx-auto mt-8 block md:mt-0 md:hidden"
                    />

                    <p className="font-roboto-flex text-left text-xl md:pr-24 md:text-2xl">
                        Send or request funds in seconds through WhatsApp, a phone number, or a QR code. No bank
                        details, no friction.
                    </p>

                    <a href="/setup" target="_blank" rel="noopener noreferrer">
                        <Button
                            shadowSize="4"
                            className="mt-8 hidden w-58 bg-white px-7 pb-11 pt-4 text-base font-extrabold hover:bg-white/90 md:inline-block md:w-72 md:px-10 md:text-lg"
                        >
                            CREATE PAYMENT LINK
                        </Button>
                    </a>
                </div>

                <div className="w-full md:w-1/3">
                    <motion.div
                        animate={{
                            rotate: [0, -2, 2, -2, 2, 0],
                            x: [0, -2, 2, -2, 2, 0],
                        }}
                        transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            repeatDelay: 1,
                            ease: 'easeInOut',
                        }}
                    >
                        <Image
                            src={iphoneDropALink}
                            alt="Drop a link"
                            width={300}
                            height={300}
                            className="mx-auto mt-8 hidden md:mt-0 md:block"
                        />
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
