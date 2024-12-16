import { Metadata } from 'next'

interface SEOConfig {
    title: string
    description: string
    image: string
    keywords?: string
}

export const seoConfigs: Record<string, SEOConfig> = {
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

export function generateMetadata(page: string): Metadata {
    const config = seoConfigs[page]
    return {
        title: config.title,
        description: config.description,
        metadataBase: new URL('https://peanut.to'),
        icons: {
            icon: '/favicon.ico',
        },
        keywords: config.keywords,
        openGraph: {
            title: config.title,
            description: config.description,
            images: [{ url: config.image }],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: config.title,
            description: config.description,
        },
    }
}
