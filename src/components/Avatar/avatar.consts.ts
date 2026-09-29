import { parseAsBoolean, parseAsString } from 'nuqs'

/** nuqs URL state of the profile avatar picker (TASK-22142). One source for
 *  the profile page and fixtures. */
export const AVATAR_PICKER_PARAM = 'avatarPicker'
// clearOnDefault (nuqs 2 default) keeps the URL clean once the drawer closes
export const avatarPickerParser = parseAsBoolean.withDefault(false)
/** Optional badge code the first hand deals from when opening the picker. */
export const AVATAR_PICKER_BADGE_PARAM = 'badge'
export const avatarPickerBadgeParser = parseAsString
export const AVATAR_PICKER_PATH = `/profile?${AVATAR_PICKER_PARAM}=true`
