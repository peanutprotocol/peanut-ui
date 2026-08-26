import Image from 'next/image'
import Title from '@/components/0_Bruddle/Title'
import { Card } from '@/components/0_Bruddle/Card'
import {
    canLabelByExtension,
    downloadLinkProps,
    extOf,
    groupKind,
    pillLabel,
    previewHrefs,
    safeHttpUrl,
    type PressAssetFile,
    type PressAssetGroup,
} from '@/components/Marketing/pressAssets'

// One card per brand-asset group on /press: a single preview well derived from
// the group's own hrefs, then the files as download pills. The well is never a
// link — the pills stay the only click targets.

const WELL = 'h-32 w-full overflow-hidden rounded-sm border border-n-1'
const PILL = 'inline-flex min-h-11 items-center rounded-sm border border-n-1 px-3 text-xs font-medium text-n-1'

export function PressAssetGroupCard({ group }: { group: PressAssetGroup }) {
    const files = (group.files ?? [])
        .map((file) => ({ name: file.name, href: safeHttpUrl(file.href) }))
        .filter((file): file is PressAssetFile => Boolean(file.href))
    if (files.length === 0) return null

    const kind = groupKind(files)
    const previews = previewHrefs(files)
    const useExt = canLabelByExtension(files)

    return (
        <Card shadowSize="4" className="gap-3 p-6">
            <h3 className="text-sm font-bold text-n-1">{group.label}</h3>

            {kind === 'image' &&
                (previews.length > 1 ? (
                    // Cream ground, not the Card's: `Card` is dark:bg-n-1 and a black mark on a dark ground breaks LOGO_RULES.
                    <div className={`${WELL} flex bg-grey-3 dark:bg-grey-3`}>
                        {previews.map((href) => (
                            <div key={href} className="relative h-full flex-1">
                                <Image
                                    src={href}
                                    alt=""
                                    fill
                                    sizes="(max-width: 768px) 18vw, 70px"
                                    className="object-contain p-2"
                                    unoptimized={extOf(href) === 'svg'}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={`${WELL} relative bg-grey-3 dark:bg-grey-3`}>
                        <Image
                            src={previews[0]}
                            alt={group.label}
                            fill
                            sizes="(max-width: 768px) 45vw, 200px"
                            // /_next/image 400s on SVG without this — Logotype/Icon/Wordmark would ship as broken boxes.
                            unoptimized={extOf(previews[0]) === 'svg'}
                            className="object-contain p-4"
                        />
                    </div>
                ))}

            {kind === 'font' && (
                // KNERD only reads as the mandated white-offset-under-outline over a colour.
                <div className={`${WELL} flex items-center justify-center bg-primary-1`} aria-hidden>
                    <Title text="KNERD" className="text-6xl" />
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {files.map((file) => (
                    <a
                        key={file.href}
                        href={file.href}
                        title={file.name}
                        aria-label={useExt ? file.name : undefined}
                        {...downloadLinkProps(file.href)}
                        className={`${PILL} hover:bg-primary-3`}
                    >
                        {pillLabel(file, useExt)}
                    </a>
                ))}
            </div>
        </Card>
    )
}
