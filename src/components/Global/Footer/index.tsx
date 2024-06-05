'use client'
import Link from 'next/link'
import { useColorMode } from '@chakra-ui/color-mode'

import * as _consts from './consts'

type FooterProps = {}

const Footer = ({}: FooterProps) => {
    const { colorMode } = useColorMode()

    return (
        <footer>
            <div className="flex w-full flex-col gap-2 border-t border-n-1 bg-black py-2 pt-4 text-white dark:border-white  dark:bg-n-2">
                <div className="flex justify-center gap-4">
                    {_consts.SOCIALS.map((social) => {
                        return (
                            <Link key={social.name} href={social.url} target="_blank">
                                <img src={social.logoSrc} className="h-6" alt="twitter" />
                            </Link>
                        )
                    })}
                </div>
                <div className="flex justify-center gap-2 ">
                    {_consts.LINKS.map((link) => {
                        return (
                            <Link
                                key={link.name}
                                href={link.url}
                                className="text-h7 transition-colors last:mr-0 hover:text-purple-1 dark:text-white dark:hover:text-purple-1 md:mr-4"
                            >
                                {link.name}
                            </Link>
                        )
                    })}
                </div>
            </div>
        </footer>
    )
}

export default Footer
