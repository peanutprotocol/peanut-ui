import '@/styles/globals.css'
import { Roboto_Flex } from 'next/font/google'
import { ColorModeScript, ColorModeProvider } from '@chakra-ui/color-mode'
import * as config from '@/config'
import * as context from '@/context'

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
                        initialColorMode="system"
                        key="chakra-ui-no-flash"
                        storageKey="chakra-ui-color-mode"
                    />
                    <config.PeanutProvider>
                        <context.ContextProvider>{children}</context.ContextProvider>
                    </config.PeanutProvider>
                </ColorModeProvider>
            </body>
        </html>
    )
}
