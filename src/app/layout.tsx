import '@/styles/globals.css'
import { Inter } from 'next/font/google'

import * as config from '@/config'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <config.PeanutProvider>{children}</config.PeanutProvider>
            </body>
        </html>
    )
}
