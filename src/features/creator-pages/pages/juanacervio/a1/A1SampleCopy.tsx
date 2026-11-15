import { NITA_A1_COPY as copy } from '../nita-a1.copy'

/** The "Copiar" label of a sample bank-details row. Part of the illustration, so it must not look like a button. */
export function A1SampleCopy() {
    return <span className="text-label-m text-foreground-secondary">{copy.sample.copy}</span>
}
