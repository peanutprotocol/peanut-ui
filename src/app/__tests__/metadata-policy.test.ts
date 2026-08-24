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

import { metadata as rootMetadata } from '../layout'
import { metadata as lpMetadata } from '../lp/layout'
import { DEFAULT_LOCALE } from '@/i18n/types'
import { landingMetadata } from '@/lib/seo/landing'

describe('route metadata ownership', () => {
    it('keeps the production root layout route-neutral', () => {
        expect(rootMetadata.alternates).toBeUndefined()
        expect(rootMetadata.robots).toBeUndefined()
    })

    it('lets public landing leaves own their canonical URLs', () => {
        expect(landingMetadata(DEFAULT_LOCALE).alternates).toMatchObject({ canonical: '/' })
        expect(lpMetadata.alternates).toEqual({ canonical: '/' })
    })
})
