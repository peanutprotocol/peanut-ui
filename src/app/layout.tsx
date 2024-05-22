import '@/styles/globals.css'
import { Roboto_Flex } from 'next/font/google'
import { ColorModeScript, ColorModeProvider } from '@chakra-ui/color-mode'
import * as config from '@/config'
import * as context from '@/context'
import Head from 'next/head'
import Script from 'next/script'

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
                {/* <Script
                    id="mouseflow-script"
                    strategy="afterInteractive"
                    dangerouslySetInnerHTML={{
                        __html: `
                            window._mfq = window._mfq || [];
                            (function() {
                            var mf = document.createElement("script");
                            mf.type = "text/javascript"; mf.defer = true;
                            mf.src = "//cdn.mouseflow.com/projects/03231380-1dcb-4e9e-86a8-47d064372cbe.js";
                            document.getElementsByTagName("head")[0].appendChild(mf);
                            })();
                        `,
                    }}
                /> */}
                <ColorModeProvider>
                    <ColorModeScript
                        initialColorMode="light"
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
