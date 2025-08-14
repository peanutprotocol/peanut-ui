import { DISCORD_ICON, GITHUB_WHITE_ICON, PEANUT_LOGO, TWITTER_ICON } from '@/assets'
import Image from 'next/image'
import React from 'react'
import handThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'
import handWaving from '@/assets/illustrations/hand-waving.svg'
import handPeace from '@/assets/illustrations/hand-peace.svg'
import handMiddleFinger from '@/assets/illustrations/hand-middle-finger.svg'

const Footer = () => {
    return (
        <footer className="relative flex h-52 items-end justify-between bg-black px-8 pb-10 md:items-center md:px-20 md:pb-0">
            <section className="flex flex-col gap-1">
                <div className="flex">
                    <Image src={PEANUT_LOGO} alt="Peanut Logo" width={110} height={40} />
                </div>
                <p className="text-xs text-white">
                    made with love by{' '}
                    <a className="underline" href="https://squirrellabs.dev/" target="_blank">
                        Squirrel Labs
                    </a>
                </p>
            </section>

            <section className="absolute left-1/2 top-5 flex -translate-x-1/2 flex-col items-center gap-4 md:static md:translate-x-0">
                <div className="flex gap-2">
                    <a
                        href="https://discord.gg/B99T9mQqBv"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Join us on Discord"
                    >
                        <Image src={DISCORD_ICON} alt="Discord" width={20} height={20} />
                    </a>
                    <a
                        href="https://x.com/PeanutProtocol"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Follow us on Twitter"
                    >
                        <Image src={TWITTER_ICON} alt="Twitter" width={20} height={20} />
                    </a>
                    <a
                        href="https://github.com/peanutprotocol"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View our GitHub"
                    >
                        <Image src={GITHUB_WHITE_ICON} alt="GitHub" width={20} height={20} />
                    </a>
                </div>

                <div className="flex gap-2">
                    <a
                        className="text-xl font-bold text-white"
                        href="https://docs.peanut.me/"
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        Docs
                    </a>
                    <a
                        className="text-xl font-bold text-white"
                        href="https://peanutprotocol.notion.site/Privacy-Policy-37debda366c941f2bbb8db8c113d8c8b"
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        Privacy
                    </a>
                    <a
                        className="text-xl font-bold text-white"
                        href="https://peanutprotocol.notion.site/Terms-of-Service-Privacy-Policy-1f245331837f4b7e860261be8374cc3a"
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        Terms
                    </a>
                    <a
                        className="text-xl font-bold text-white"
                        href="https://peanutprotocol.notion.site/Career-b351de56d92e405e962f0027b3a60f52"
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        Jobs
                    </a>
                </div>
            </section>

            <section className="flex gap-3">
                <a
                    href="https://youtube.com/shorts/qd2FbzLS380?si=T5xk7xrTGYiIiWFu"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Watch Peanut teaser on YouTube (opens in a new tab)"
                >
                    <Image src={handPeace} alt="" width={20} height={20} />
                </a>
                <Image src={handThumbsUp.src} alt="Hand thumbs up" width={20} height={20} />
                <a
                    href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Never gonna give you up (opens in a new tab)"
                >
                    <Image src={handMiddleFinger.src} alt="Hand Middle finger" width={20} height={20} />
                </a>
                <Image src={handWaving.src} alt="Hand waving" width={25} height={25} />
            </section>
        </footer>
    )
}

export default Footer
