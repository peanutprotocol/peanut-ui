import { HOME_PERSONA_AVATARS } from './homePersona.consts'
import type { HomePersona, HomePersonaStrings } from './homePersona.types'

/** The fold's earners in cycling order, each with its sticker and its text in the page language. */
export function homePersonas(strings: HomePersonaStrings): HomePersona[] {
    return HOME_PERSONA_AVATARS.map(({ key, avatar }) => ({ key, avatar, ...strings[key] }))
}
