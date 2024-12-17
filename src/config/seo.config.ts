import { Metadata } from 'next'

type Page = 'landing' | 'cashout' | 'send' | 'requestCreate' | 'terms' | 'privacy' | 'jobs'

interface SEOConfig {
    title: string
    description: string
    image: string
    keywords?: string
}

export const seoConfigs: Record<Page, SEOConfig> = {
    landing: {
        title: 'Peanut Protocol | Cross-Chain Payment Infrastructure',
        description:
            'Seamless cross-chain payment infrastructure for sending and receiving digital assets. Built for both developers and consumers to abstract away blockchain complexities with chain-agnostic transfers, stablecoin conversions, and fiat offramps.',
        image: '/metadata-img.png',
        keywords:
            'blockchain payments, cross-chain transfers, payment infrastructure, crypto payments, stablecoin conversion, fiat offramp, web3 payments, blockchain protocol',
    },
    cashout: {
        title: 'Cash Out Crypto | Peanut',
        description:
            'Convert your crypto to fiat and withdraw directly to your bank account. Fast, secure crypto offramp.',
        image: '/metadata-img.png',
        keywords: 'crypto cashout, offramp, crypto to bank, digital dollars, fiat withdrawal',
    },
    send: {
        title: 'Send Crypto | Peanut',
        description:
            'Send cryptocurrency securely using shareable links or to an email, phone number, ENS, or wallet address. Transfer tokens across chains easily with Peanut',
        image: '/metadata-img.png',
        keywords: 'crypto transfer, send crypto, cross-chain transfer, offramp, digital dollars',
    },
    requestCreate: {
        title: 'Request Payment | Peanut',
        description: 'Request cryptocurrency from friends, family, or anyone else using Peanut on any chain.',
        image: '/metadata-img.png',
        keywords: 'crypto request, crypto payment, crypto invoice, crypto payment link',
    },
    terms: {
        title: 'Terms of Service | Peanut',
        description: 'Legal terms and conditions for using Peanut and the Peanut Protocol',
        image: '/metadata-img.png',
        keywords: 'terms of service, legal, terms, conditions',
    },
    privacy: {
        title: 'Privacy Policy | Peanut',
        description: 'Privacy policy for Peanut and the Peanut Protocol',
        image: '/metadata-img.png',
        keywords: 'privacy policy, legal, terms, conditions',
    },
    jobs: {
        title: 'Jobs | Peanut',
        description: 'Join the Peanut team and help us build the future of crypto payments.',
        image: '/metadata-img.png',
        keywords: 'jobs, careers, work, employment, crypto, payments',
    },
}

export function generateMetadata(page: Page): Metadata {
    const config = seoConfigs[page]
    const baseMetadata: Metadata = {
        title: config.title,
        description: config.description,
        metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.to'),
        icons: {
            icon: '/favicon.ico',
        },
        keywords: config.keywords,
        openGraph: {
            type: 'website',
            title: config.title,
            description: config.description,
            url: 'https://peanut.to',
            siteName: 'Peanut Protocol',
            images: [
                {
                    url: config.image,
                    width: 1200,
                    height: 630,
                    alt: config.title,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: config.title,
            description: config.description,
            images: [config.image],
            creator: '@PeanutProtocol',
            site: '@PeanutProtocol',
        },
        viewport: {
            width: 'device-width',
            initialScale: 1,
            maximumScale: 1,
            userScalable: false,
        },
    }

    return baseMetadata
}
