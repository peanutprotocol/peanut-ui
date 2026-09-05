import { parseAsBoolean, parseAsString } from 'nuqs'

/** nuqs URL state of the profile avatar picker (TASK-22142). One source for
 *  the profile page, the badge-earned toast deep link and the fixtures. */
export const AVATAR_PICKER_PARAM = 'avatarPicker'
/** Badge code the first hand deals from — set by the badge-earned toast. */
export const AVATAR_PICKER_BADGE_PARAM = 'badge'
// clearOnDefault (nuqs 2 default) keeps the URL clean once the drawer closes
export const avatarPickerParsers = {
    [AVATAR_PICKER_PARAM]: parseAsBoolean.withDefault(false),
    [AVATAR_PICKER_BADGE_PARAM]: parseAsString,
}
export const AVATAR_PICKER_PATH = `/profile?${AVATAR_PICKER_PARAM}=true`
/** The picker deep link, with the badge the first hand must deal from when given. */
export const avatarPickerPath = (badgeCode?: string): string =>
    badgeCode
        ? `${AVATAR_PICKER_PATH}&${AVATAR_PICKER_BADGE_PARAM}=${encodeURIComponent(badgeCode)}`
        : AVATAR_PICKER_PATH

/**
 * Display names of the basic avatars, keyed by slug, for a tile's accessible
 * name. A UI table on purpose: the slugs predate the art (`frog` draws an
 * axolotl) and the API-side rename of the slugs is still open.
 */
export const AVATAR_CAST: Readonly<Record<string, string>> = {
    apple: 'Jackpot Cherry',
    avocado: 'Watermelon Slice',
    cactus: 'Bold Chili',
    cloud: 'Grumpy Raincloud',
    cube: 'Lucky Die',
    donut: 'Glazed Donut',
    drop: 'Boba Cup',
    egg: 'Fortune Cookie',
    fish: 'Puffy Pufferfish',
    flower: 'Lucky Ladybug',
    frog: 'Smiley Axolotl',
    gem: 'Lucky Horseshoe',
    ghost: 'Lucky Cat',
    heart: 'Serene Capybara',
    leaf: 'Twisted Pretzel',
    moon: 'Ramen Bowl',
    mushroom: 'Prickly Hedgehog',
    planet: 'Sideways Crab',
    star: 'Wishing Star',
    sun: 'Bossy Goose',
}
