/** @jest-environment node */
jest.mock('@/constants/general.consts', () => ({ BASE_URL: 'https://peanut.me' }))

import robots from '@/app/robots'
import {
    SPLIT_CANARY_GUIDE_PATHS,
    SPLIT_CONTENT_RELEASE_DOCUMENT_VERSION,
    SPLIT_SITEMAP_PATH,
} from '@/utils/split-content-edge'

const previousRelease = process.env.SPLIT_CONTENT_RELEASE_DOCUMENT

function releaseDocument(index: boolean): string {
    return JSON.stringify({
        version: SPLIT_CONTENT_RELEASE_DOCUMENT_VERSION,
        stage: 2,
        index,
        manifest: {
            schema_version: 1,
            sha256s: ['1'.repeat(64)],
            public_paths: [...SPLIT_CANARY_GUIDE_PATHS],
        },
        released_paths: [...SPLIT_CANARY_GUIDE_PATHS],
    })
}

afterEach(() => {
    if (previousRelease === undefined) delete process.env.SPLIT_CONTENT_RELEASE_DOCUMENT
    else process.env.SPLIT_CONTENT_RELEASE_DOCUMENT = previousRelease
})

describe('Split sitemap robots release gate', () => {
    it.each([undefined, '', '{', releaseDocument(false)])(
        'advertises only the parent sitemap while the Split index gate is closed',
        (release) => {
            if (release === undefined) delete process.env.SPLIT_CONTENT_RELEASE_DOCUMENT
            else process.env.SPLIT_CONTENT_RELEASE_DOCUMENT = release

            expect(robots().sitemap).toBe('https://peanut.me/sitemap.xml')
        }
    )

    it('advertises both sitemaps only for a valid complete index release', () => {
        process.env.SPLIT_CONTENT_RELEASE_DOCUMENT = releaseDocument(true)

        expect(robots().sitemap).toEqual(['https://peanut.me/sitemap.xml', `https://peanut.me${SPLIT_SITEMAP_PATH}`])
    })
})
