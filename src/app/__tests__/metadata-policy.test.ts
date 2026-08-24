jest.mock('next/font/google', () => ({
    Londrina_Solid: () => ({ variable: '--font-londrina' }),
    Roboto_Flex: () => ({ variable: '--font-roboto' }),
    Sniglet: () => ({ variable: '--font-sniglet' }),
}))
jest.mock('next/font/local', () => ({
    __esModule: true,
    default: () => ({ variable: '--font-local' }),
}))
jest.mock('next/script', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('../ClientProviders', () => ({ ClientProviders: jest.fn() }))
jest.mock('../../styles/globals.css', () => ({}))
jest.mock('@/constants/general.consts', () => ({
    BASE_URL: 'https://peanut.me',
    PEANUT_API_URL: 'https://api.peanut.me',
}))

import { metadata as lpMetadata } from '../lp/layout'
import { DEFAULT_LOCALE } from '@/i18n/types'
import { landingMetadata } from '@/lib/seo/landing'

const ORIGINAL_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL

async function rootMetadataFor(baseUrl?: string) {
    jest.resetModules()
    if (baseUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
    else process.env.NEXT_PUBLIC_BASE_URL = baseUrl

    return (await import('../layout')).metadata
}

describe('route metadata ownership', () => {
    afterEach(() => {
        if (ORIGINAL_BASE_URL === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
        else process.env.NEXT_PUBLIC_BASE_URL = ORIGINAL_BASE_URL
    })

    it.each(['https://peanut.me', 'https://peanut.me/'])(
        'keeps the explicitly configured production root layout route-neutral (%s)',
        async (baseUrl) => {
            const rootMetadata = await rootMetadataFor(baseUrl)

            expect(rootMetadata.alternates).toBeUndefined()
            expect(rootMetadata.robots).toBeUndefined()
        }
    )

    it.each([
        undefined,
        '',
        'https://staging.peanut.me',
        'https://preview.example.vercel.app',
        'https://peanut.example.org',
        'https://peanut.me.evil.example',
    ])('fails closed when the production origin is not explicit (%s)', async (baseUrl) => {
        const rootMetadata = await rootMetadataFor(baseUrl)

        expect(rootMetadata.robots).toEqual({ index: false, follow: false })
    })

    it('lets public landing leaves own their canonical URLs', () => {
        expect(landingMetadata(DEFAULT_LOCALE).alternates).toMatchObject({ canonical: '/' })
        expect(lpMetadata.alternates).toEqual({ canonical: '/' })
    })
})
