import { Roboto_Flex } from 'next/font/google'
import * as config from '@/config'
import * as context from '@/context'
import CrispChat from '../components/CrispChat'

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
                <config.PeanutProvider>
                    <context.ContextProvider>
                        {children}
                        {/* TODO: move to single page */}
                        {/* <CrispChat /> */}
                    </context.ContextProvider>
                </config.PeanutProvider>
            </body>
        </html>
    )
}
