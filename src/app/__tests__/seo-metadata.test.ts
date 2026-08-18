/** @jest-environment node */

jest.mock('@/components/Jobs', () => ({ Careers: () => null }))
jest.mock('@/components/LandingPage/LandingPageShell', () => ({ LandingPageShell: () => null }))
jest.mock('@/components/LandingPage/Footer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/app/lp/card/CardLandingPage', () => ({ __esModule: true, default: () => null }))

import { metadata as careersMetadata } from '@/app/careers/page'
import { metadata as cardMetadata } from '@/app/lp/card/page'
import { BASE_URL } from '@/constants/general.consts'

describe('standalone indexable page metadata', () => {
    it.each([
        ['careers', careersMetadata, '/careers'],
        ['card landing page', cardMetadata, '/lp/card'],
    ])('%s has a self-canonical and matching Open Graph URL', (_name, metadata, path) => {
        expect(metadata.alternates?.canonical).toBe(path)
        expect(metadata.openGraph?.url).toBe(`${BASE_URL}${path}`)
        expect(metadata.robots).toBeUndefined()
    })
})
