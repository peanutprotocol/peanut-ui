'use client'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Button } from '../0_Bruddle'
import iphoneDropALink from '@/assets/iphone-ss/iphone-drop-a-link.png'
import iphoneDropALinkMobile from '@/assets/iphone-ss/iphone-drop-a-link-mobile.png'
import { WHATSAPP_ICON, IMESSAGE_ICON, FBMessenger_ICON, TELEGRAM_ICON } from '@/assets/icons'

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
                        PAYING AS EASY AS A TEXT.
                    </h1>

                    <div className="relative mx-auto mt-8 block md:mt-0 md:hidden">
                        {/* Mobile Floating Icons */}
                        <motion.div
                            className="absolute -left-6 top-20 z-10"
                            animate={{
                                y: [0, -15, 0],
                                rotate: [0, 8, -8, 0],
                                x: [0, -3, 3, 0],
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: 'easeInOut',
                            }}
                        >
                            <Image src={WHATSAPP_ICON} alt="WhatsApp" width={52} height={52} className="size-12" />
                        </motion.div>

                        <motion.div
                            className="absolute -right-4 top-20 z-10"
                            animate={{
                                y: [0, -18, 0],
                                x: [0, 6, 0],
                                rotate: [0, -6, 6, 0],
                            }}
                            transition={{
                                duration: 2.5,
                                repeat: Infinity,
                                ease: 'easeInOut',
                                delay: 0.5,
                            }}
                        >
                            <Image src={IMESSAGE_ICON} alt="iMessage" width={28} height={28} className="size-12" />
                        </motion.div>

                        <motion.div
                            className="absolute -left-4 bottom-16 z-10"
                            animate={{
                                y: [0, -12, 0],
                                rotate: [0, -10, 10, 0],
                                x: [0, 5, -5, 0],
                            }}
                            transition={{
                                duration: 2.8,
                                repeat: Infinity,
                                ease: 'easeInOut',
                                delay: 1,
                            }}
                        >
                            <Image
                                src={FBMessenger_ICON}
                                alt="Facebook Messenger"
                                width={42}
                                height={42}
                                className="size-12"
                            />
                        </motion.div>

                        <motion.div
                            className="absolute -right-6 bottom-16 z-10"
                            animate={{
                                y: [0, -16, 0],
                                x: [0, -4, 4, 0],
                                rotate: [0, 12, -12, 0],
                            }}
                            transition={{
                                duration: 3.2,
                                repeat: Infinity,
                                ease: 'easeInOut',
                                delay: 1.5,
                            }}
                        >
                            <Image src={TELEGRAM_ICON} alt="Telegram" width={34} height={34} className="size-12" />
                        </motion.div>

                        <Image
                            src={iphoneDropALinkMobile}
                            alt="Drop a link"
                            width={200}
                            height={200}
                            className="mx-auto"
                        />
                    </div>

                    <p className="font-roboto-flex text-left text-xl md:pr-24 md:text-2xl">
                        Chat or IRL. Works on WhatsApp, SMS, QR codes. No bank details, they don&apos;t even need to
                        signup or install Peanut.
                    </p>

                    <a href="/setup" target="_blank" rel="noopener noreferrer">
                        <Button
                            shadowSize="4"
                            className="mt-8 hidden w-58 bg-white px-7 pb-11 pt-4 text-base font-extrabold hover:bg-white/90 md:inline-block md:w-72 md:px-10 md:text-lg"
                        >
                            JOIN WAITLIST
                        </Button>
                    </a>
                </div>

                <div className="relative w-full md:w-1/3">
                    {/* Desktop Floating Icons */}
                    <motion.div
                        className="absolute -left-8 -top-4 z-10 hidden md:block"
                        animate={{
                            y: [0, -20, 0],
                            rotate: [0, 10, -10, 0],
                            x: [0, -5, 5, 0],
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    >
                        <Image src={WHATSAPP_ICON} alt="WhatsApp" width={50} height={50} className="h-12 w-12" />
                    </motion.div>

                    <motion.div
                        className="absolute -right-6 -top-8 z-10 hidden md:block"
                        animate={{
                            y: [0, -25, 0],
                            x: [0, 10, 0],
                            rotate: [0, -8, 8, 0],
                        }}
                        transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: 0.5,
                        }}
                    >
                        <Image src={IMESSAGE_ICON} alt="iMessage" width={46} height={46} className="h-11 w-11" />
                    </motion.div>

                    <motion.div
                        className="absolute -bottom-4 -left-6 z-10 hidden md:block"
                        animate={{
                            y: [0, -18, 0],
                            rotate: [0, -12, 12, 0],
                            x: [0, 8, -8, 0],
                        }}
                        transition={{
                            duration: 2.8,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: 1,
                        }}
                    >
                        <Image
                            src={FBMessenger_ICON}
                            alt="Facebook Messenger"
                            width={48}
                            height={48}
                            className="h-12 w-12"
                        />
                    </motion.div>

                    <motion.div
                        className="absolute -bottom-8 -right-4 z-10 hidden md:block"
                        animate={{
                            y: [0, -22, 0],
                            x: [0, -8, 8, 0],
                            rotate: [0, 15, -15, 0],
                        }}
                        transition={{
                            duration: 3.2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: 1.5,
                        }}
                    >
                        <Image src={TELEGRAM_ICON} alt="Telegram" width={52} height={52} className="h-13 w-13" />
                    </motion.div>

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
