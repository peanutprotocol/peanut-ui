/** One real post on the wall, verbatim from content/_system/generated/testimonials.json. */
export interface WallOfLovePost {
    url: string
    author: string
    handle: string
    content: string
    avatar?: string
}

export interface HomeWallOfLoveProps {
    /** The h2, e.g. "Wall of love.". The posts stay in their own language. */
    heading: string
    posts: readonly WallOfLovePost[]
}

export interface WallOfLoveAvatarProps {
    post: WallOfLovePost
}
