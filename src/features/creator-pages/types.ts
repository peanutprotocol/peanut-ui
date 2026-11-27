/** What the /c/<username> route hands a creator page: who it is for and which arm of the test it is. */
export type CreatorPageProps = {
    /** Lowercase Peanut username of the creator: the key of experiments.ts and the inviter on the CTA. */
    username: string
    /** Recorded as `experiment_id`. */
    experimentId: string
    /** Recorded as `variant`. */
    variant: string
}
