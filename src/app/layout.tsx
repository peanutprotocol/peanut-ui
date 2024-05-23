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
            <Head>
          {/* Smartlook Tracking Code */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.smartlook||(function(d) {
                var o=smartlook=function(){ o.api.push(arguments)},h=d.getElementsByTagName('head')[0];
                var c=d.createElement('script');o.api=new Array();c.async=true;c.type='text/javascript';
                c.charset='utf-8';c.src='https://rec.smartlook.com/recorder.js';h.appendChild(c);
                })(document);
                smartlook('init', '88a7f1ea0bfad16890146518515b80a666bc58c3');
              `,
            }}
          />
        </Head>
            <body className={`${roboto.variable} font-sans`}>
               
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
