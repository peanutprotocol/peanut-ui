import '@/styles/globals.css'
import { Roboto_Flex, Londrina_Solid, Sniglet } from 'next/font/google'
import CrispChat from '../components/CrispChat'
import { PeanutProvider } from '@/config'
import { ContextProvider } from '@/config'
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
                    <PeanutProvider>
                        <ContextProvider>
                            <CrispChat />
                                <FooterVisibilityProvider>
                                    {children}
                                </FooterVisibilityProvider>
                            <CrispChat />
                        </ContextProvider>
                    </PeanutProvider>
            </body>
        </html>
    )
}
