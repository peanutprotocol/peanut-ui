'use client'

import { createContext } from 'react'

/** The limits page listens so "Increase limits" steps down to secondary while the cap card offers its raise. */
export const CapNudgeCtaContext = createContext<(shown: boolean) => void>(() => {})
