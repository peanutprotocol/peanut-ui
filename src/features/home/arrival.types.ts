import type { ArrivalPrompt } from '@/services/arrival'

/** An arrival prompt the backend raised for this user in this app session. */
export type Arrival = { userId: string; country: string; prompt: ArrivalPrompt }
