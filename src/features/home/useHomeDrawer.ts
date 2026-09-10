'use client'

import { parseAsStringEnum, useQueryState } from 'nuqs'

export const HOME_DRAWERS = ['add', 'send'] as const
export type HomeDrawer = (typeof HOME_DRAWERS)[number]

/**
 * home IA drawer state (figma section 17609:2334): which bottom drawer is open
 * on /home. url-backed (?drawer=add|send) so the state deep-links and survives
 * refresh; null = closed.
 */
export const useHomeDrawer = () => useQueryState('drawer', parseAsStringEnum<HomeDrawer>([...HOME_DRAWERS]))
