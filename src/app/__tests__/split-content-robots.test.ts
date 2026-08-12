/** @jest-environment node */
jest.mock('@/constants/general.consts', () => ({ BASE_URL: 'https://peanut.me' }))

import robots from '@/app/robots'
import {
    SPLIT_CANARY_GUIDE_PATHS,
    SPLIT_CONTENT_RELEASE_DOCUMENT_VERSION,
    SPLIT_SITEMAP_PATH,
} from '@/utils/split-content-edge'

const MARKER = 'split-content-robots-marker-at-least-32-bytes'
const previous = {
    marker: process.env.SPLIT_CONTENT_EDGE_MARKER,
    origin: process.env.SPLIT_CONTENT_ORIGIN,
    release: process.env.SPLIT_CONTENT_RELEASE_DOCUMENT,
}

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
    restoreEnv('SPLIT_CONTENT_EDGE_MARKER', previous.marker)
    restoreEnv('SPLIT_CONTENT_ORIGIN', previous.origin)
    restoreEnv('SPLIT_CONTENT_RELEASE_DOCUMENT', previous.release)
})

describe('Split sitemap robots release gate', () => {
    it.each([
        ['all values absent', undefined, undefined, undefined],
        ['release absent', 'https://renderer.example', MARKER, undefined],
        ['release empty', 'https://renderer.example', MARKER, ''],
        ['release malformed', 'https://renderer.example', MARKER, '{'],
        ['release index withheld', 'https://renderer.example', MARKER, releaseDocument(false)],
        ['origin absent', undefined, MARKER, releaseDocument(true)],
        ['origin malformed', 'not-a-url', MARKER, releaseDocument(true)],
        ['origin insecure', 'http://renderer.example', MARKER, releaseDocument(true)],
        ['marker absent', 'https://renderer.example', undefined, releaseDocument(true)],
        ['marker short', 'https://renderer.example', 'too-short', releaseDocument(true)],
        ['renderer points at the parent origin', 'https://peanut.me', MARKER, releaseDocument(true)],
    ] as const)('advertises only the parent sitemap when %s', (_label, origin, marker, release) => {
        restoreEnv('SPLIT_CONTENT_ORIGIN', origin)
        restoreEnv('SPLIT_CONTENT_EDGE_MARKER', marker)
        restoreEnv('SPLIT_CONTENT_RELEASE_DOCUMENT', release)

        expect(robots().sitemap).toBe('https://peanut.me/sitemap.xml')
    })

    it('advertises both sitemaps only for a valid complete index release', () => {
        process.env.SPLIT_CONTENT_ORIGIN = 'https://renderer.example'
        process.env.SPLIT_CONTENT_EDGE_MARKER = MARKER
        process.env.SPLIT_CONTENT_RELEASE_DOCUMENT = releaseDocument(true)

        expect(robots().sitemap).toEqual(['https://peanut.me/sitemap.xml', `https://peanut.me${SPLIT_SITEMAP_PATH}`])
    })
})

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
}
