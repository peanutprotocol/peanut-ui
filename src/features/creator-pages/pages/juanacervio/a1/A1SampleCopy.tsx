import { NITA_A1_COPY as copy } from '../nita-a1.copy'

/** The "Copiar" pill of a sample bank-details row. Part of the illustration, not a control. */
export function A1SampleCopy() {
    return <span className="rounded-full border border-border-button px-2 py-0.5 text-label-m">{copy.sample.copy}</span>
}
