'use client'
import Link from 'next/link'
import { useColorMode } from '@chakra-ui/color-mode'

import * as _consts from './consts'

type FooterProps = {
    newLayout?: boolean
}

const Footer = ({ newLayout = false }: FooterProps) => {
    const { colorMode } = useColorMode()

    return (
        <footer>
            <div
                className={`flex w-full items-center gap-4 px-4 py-2 pt-4 dark:border-white dark:bg-n-2 ${!newLayout ? 'justify-between border-t border-n-1 bg-black text-white' : 'flex-wrap justify-center border-t-2 border-n-1 bg-white py-4 shadow ring-2 ring-white md:p-6 lg:justify-between'}`}
            >
                <div className="flex justify-center gap-2">
                    {_consts.LINKS.map((link) => {
                        return (
                            <Link
                                key={link.name}
                                href={link.url}
                                className="font-bold uppercase transition-colors last:mr-0 hover:text-violet-3 dark:text-white dark:hover:text-purple-1 md:mr-4"
                            >
                                {link.name}
                            </Link>
                        )
                    })}
                </div>

                <div className="flex justify-center gap-4">
                    {_consts.SOCIALS.map((social) => {
                        return (
                            <Link
                                key={social.name}
                                href={social.url}
                                target="_blank"
                                className="font-semibold uppercase transition-colors last:mr-0 hover:text-violet-3 dark:text-white dark:hover:text-purple-1 md:mr-4"
                            >
                                {/* <img src={social.logoSrc} className="h-6" alt={social.name} /> */}
                                {social.name}
                            </Link>
                        )
                    })}
                </div>
            </div>
        </footer>
    )
}

export default Footer
