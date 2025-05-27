import { generateMetadata } from '@/app/metadata'
import React from 'react'

export const metadata = generateMetadata({
    title: 'Home | Peanut',
    description:
        'Send and receive money instantly with Peanut. Fast, secure, and global peer-to-peer payments with digital dollars.',
    image: '/metadata-img.png',
    keywords:
        'send money, receive money, peer-to-peer payments, digital dollars, P2P payments, fast payments, secure payments',
})

export default function WithdrawLayout({ children }: { children: React.ReactNode }) {
    return children
}
