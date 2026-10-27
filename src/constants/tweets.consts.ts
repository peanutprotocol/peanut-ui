import type { WallOfLovePost } from '@/components/LandingPage/homeWallOfLove.types'
// Authored in mono at content/_system/generated/testimonials.json; ships through the content mirror.
import testimonials from '@/content/generated/testimonials.json'

/**
 * The home's wall of love, in order: six real posts a stranger reads without
 * context (product feel first). Picked by hand, not by impact_score; a post
 * hidden in the manifest (`visible: false`) drops out rather than showing.
 * Phones show the first three.
 */
const WALL_OF_LOVE_URLS = [
    'https://x.com/Emmy_Wilz_01/status/1993198570225238514',
    'https://x.com/theZeugh/status/1993446136867393834',
    'https://x.com/candicekteo/status/1993420115509956930',
    'https://x.com/DAppaDanDev/status/1992935274523840902',
    'https://x.com/yssf_io/status/1993363153611374973',
    'https://x.com/cxqmaggie/status/1993393875059441999',
] as const

const posts = (testimonials as { tweets: (WallOfLovePost & { visible?: boolean })[] }).tweets

export const WALL_OF_LOVE_POSTS: WallOfLovePost[] = WALL_OF_LOVE_URLS.flatMap((url) => {
    const post = posts.find((candidate) => candidate.url === url && candidate.visible !== false)
    return post
        ? [{ url: post.url, author: post.author, handle: post.handle, content: post.content, avatar: post.avatar }]
        : []
})
