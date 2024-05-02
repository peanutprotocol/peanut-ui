'use client'
import Link from "next/link";
import {  useColorMode } from "@chakra-ui/color-mode";

import * as _consts from "./consts";

type FooterProps = {};

const Footer = ({}: FooterProps) => {
    const { colorMode } = useColorMode();

    return (
        <footer>
        <div className="dark:border-white border-t border-n-1 pt-4 bg-background dark:bg-n-2 md:!bg-transparent flex w-full gap-2 my-2 flex-col">
            <div className="flex justify-center gap-4">
                {_consts.SOCIALS.map((social) => {
                    return (
                        <Link key={social.name} href={social.url} target="_blank">
                            <img src={colorMode === "dark" ? social.invertedLogoSrc : social.logoSrc} className="h-6" alt="twitter" />
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
                            className="text-h7 dark:text-white dark:hover:text-purple-1 hover:text-purple-1 transition-colors last:mr-0 md:mr-4"
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


export default Footer;
