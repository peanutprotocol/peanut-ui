import { QrBrazilQrCode } from './QrBrazilQrCode'

const FIELD =
    'truncate rounded-card border-2 border-border-default bg-background-default px-2 py-2 text-body-xs xs:px-3 xs:text-body-s-semibold'
const LABEL = 'text-body-m-semibold'

/** The three things Peanut pays at a Brazilian counter: a Pix QR, a Pix key, a copia e cola code. */
export function QrBrazilWaysIn() {
    return (
        <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-3 text-left xs:grid-cols-[7rem_minmax(0,1fr)]">
            <div className="row-span-2 grid gap-1 self-end">
                <span className={LABEL}>Pix QR</span>
                <div className="rounded-sm border-2 border-border-default bg-background-default p-2">
                    <QrBrazilQrCode className="w-full" />
                </div>
            </div>
            <div className="grid gap-1">
                <span className={LABEL}>Pix key</span>
                <div className={FIELD}>12.345.678/0001-00</div>
            </div>
            <div className="grid gap-1">
                <span lang="pt-BR" className={LABEL}>
                    Copia e cola
                </span>
                <div className={FIELD}>00020126…br.gov.bcb.pix</div>
            </div>
        </div>
    )
}
