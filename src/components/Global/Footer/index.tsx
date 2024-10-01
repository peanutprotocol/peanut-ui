'use client'
import React from 'react'
import Link from 'next/link'

import { LINKS, SOCIALS } from './consts'

const Footer = () => {

    return (
        <footer>
            <div className="flex w-full flex-wrap items-center justify-center gap-4 border-t-2 border-n-1 bg-white px-4 py-2 py-4 pt-4 shadow ring-2 ring-white dark:border-white dark:bg-n-2 md:p-6 lg:justify-between">
                <div className="flex justify-center gap-2">
                    {LINKS.map((link) => {
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
                    {SOCIALS.map((social) => {
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
