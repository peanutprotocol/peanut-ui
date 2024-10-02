import '@/styles/globals.css'
import { Roboto_Flex, Londrina_Solid, Sniglet } from 'next/font/google'
import { ColorModeScript, ColorModeProvider } from '@chakra-ui/color-mode'
import { PeanutProvider } from '@/config'
import { ContextProvider } from '@/config'
import Head from 'next/head'
import { FooterVisibilityProvider } from '@/context/footerVisibility'

const roboto = Roboto_Flex({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-roboto',
    axes: ['wdth'],
})

const londrina = Londrina_Solid({
    weight: ['400', '900'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-londrina',
})

const sniglet = Sniglet({
    weight: ['400', '800'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-sniglet',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={`${roboto.variable} ${londrina.variable} ${sniglet.variable} chakra-ui-light font-sans`}>
                {/* <ColorModeProvider>
                    <ColorModeScript
                        initialColorMode="light"
                        key="chakra-ui-no-flash"
                        storageKey="chakra-ui-color-mode"
                    /> */}
                <PeanutProvider>
                    <ContextProvider>
                        <FooterVisibilityProvider>{children}</FooterVisibilityProvider>
                    </ContextProvider>
                </PeanutProvider>
                {/* </ColorModeProvider> */}
            </body>
        </html>
    )
}
