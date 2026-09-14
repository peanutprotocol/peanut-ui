import { parseAsBoolean, parseAsString } from 'nuqs'

/** nuqs URL state of the profile avatar picker (TASK-22142). One source for
 *  the profile page, the badge-earned toast deep link and the fixtures. */
export const AVATAR_PICKER_PARAM = 'avatarPicker'
// clearOnDefault (nuqs 2 default) keeps the URL clean once the drawer closes
export const avatarPickerParser = parseAsBoolean.withDefault(false)
/** Badge code the first hand deals from — set by the badge-earned toast. */
export const AVATAR_PICKER_BADGE_PARAM = 'badge'
export const avatarPickerBadgeParser = parseAsString
export const AVATAR_PICKER_PATH = `/profile?${AVATAR_PICKER_PARAM}=true`
/** The picker deep link, with the badge the first hand must deal from when given. */
export const avatarPickerPath = (badgeCode?: string): string =>
    badgeCode
        ? `${AVATAR_PICKER_PATH}&${AVATAR_PICKER_BADGE_PARAM}=${encodeURIComponent(badgeCode)}`
        : AVATAR_PICKER_PATH
