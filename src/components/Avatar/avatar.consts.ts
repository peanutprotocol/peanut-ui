import { parseAsBoolean } from 'nuqs'

/** nuqs URL state of the profile avatar picker (TASK-22142). One source for
 *  the profile page, the badge-earned toast deep link and the fixtures. */
export const AVATAR_PICKER_PARAM = 'avatarPicker'
// clearOnDefault (nuqs 2 default) keeps the URL clean once the drawer closes
export const avatarPickerParser = parseAsBoolean.withDefault(false)
export const AVATAR_PICKER_PATH = `/profile?${AVATAR_PICKER_PARAM}=true`
