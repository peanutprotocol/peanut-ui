import '@/styles/globals.css'
import { Roboto_Flex } from 'next/font/google'
import { ColorModeScript, ColorModeProvider } from '@chakra-ui/color-mode'
import * as config from '@/config'
import * as context from '@/context'
import CrispChat from '../components/CrispChat'
import { manifest } from '@/constants'
import { PWAInstaller } from '@/components/PWA'

const roboto = Roboto_Flex({
    weight: ['400', '500', '700', '800'],
    subsets: ['latin'],
    display: 'block',
    variable: '--font-roboto',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={`${roboto.variable} font-sans`}>
                <ColorModeProvider>
                    <ColorModeScript
                        initialColorMode="light"
                        key="chakra-ui-no-flash"
                        storageKey="chakra-ui-color-mode"
                    />
                    <config.PeanutProvider>
                        <context.ContextProvider>
                            {children}
                            <CrispChat />
                            <PWAInstaller
                                name={manifest.short_name}
                                description={manifest.description}
                                icon={'/pwa/icon-512x512.png'}
                                manual-apple="true"
                                manual-chrome="true"
                                // One space bc empty string is replaced with the default description
                                install-description=" "
                            />
                        </context.ContextProvider>
                    </config.PeanutProvider>
                </ColorModeProvider>
            </body>
        </html>
    )
}
