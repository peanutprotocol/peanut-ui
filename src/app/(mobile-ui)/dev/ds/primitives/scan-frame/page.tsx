'use client'

import PeanutMascot from '@/components/Global/PeanutMascot'
import { ScanFrame } from '@/components/Global/ScanFrame'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { ProductUsage } from '../../_components/ProductUsage'
import { PropsTable } from '../../_components/PropsTable'
import { SectionDivider } from '../../_components/SectionDivider'
import { WhenToUse } from '../../_components/WhenToUse'

export default function ScanFramePage() {
    return (
        <DocPage>
            <DocHeader
                title="ScanFrame"
                description="The scanner frame: four corner marks round whatever it holds, with an optional sweeping scan line. A UI object, not art. Code-only, ruling pending."
                status="limited"
            />

            <WhenToUse
                use={[
                    'A face-scan or passkey moment: the frame goes round an approved mascot or a real capture',
                    'A scan moment that needs the sweeping bar: pass scanLine while the scan runs',
                ]}
                dontUse={[
                    'A frame round a drawn face or a stock icon used as hero art: put approved art inside instead',
                    'A camera view for a real QR scan: that is the scanner screen, not this decoration',
                    'Motion under reduced motion: pass scanLine and entrance as false, the frame has no reduced-motion logic of its own',
                ]}
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'children', type: 'ReactNode', default: '-' },
                    { name: 'size', type: "'md' | 'lg'", default: "'md'" },
                    { name: 'scanLine', type: 'boolean', default: 'false' },
                    { name: 'entrance', type: 'boolean', default: 'false' },
                    { name: 'className', type: 'string', default: '-' },
                ]}
            />

            <DocSection title="Examples">
                <DocSection.Content>
                    <div className="flex flex-wrap gap-8">
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">md, mascot inside</p>
                            <ScanFrame className="flex h-44 w-36 items-center justify-center">
                                <PeanutMascot pose="too-cool" className="h-32 w-auto" />
                            </ScanFrame>
                        </div>
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">lg, scan line</p>
                            <ScanFrame size="lg" scanLine className="flex h-44 w-36 items-center justify-center">
                                <PeanutMascot pose="too-cool" className="h-32 w-auto" />
                            </ScanFrame>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import { ScanFrame } from '@/components/Global/ScanFrame'`} />
                    <CodeBlock
                        label="Usage"
                        code={`<ScanFrame scanLine={scanning && !reducedMotion} className="absolute inset-0">
    <MascotStage pose="too-cool" {...MASCOT} />
</ScanFrame>`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Sign-up 03 Passkey: the frame round the peanut"
                    path="src/components/Setup/redesign/Passkey/PasskeyBrackets.tsx"
                    description="Corners only; they slide in once on mount. The peanut is placed beside it in the art box."
                    code={`<ScanFrame entrance={motionOn} className="absolute inset-0" />`}
                >
                    <ScanFrame entrance className="h-32 w-28" />
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Sign-up 11 Final confirm: the too-cool peanut in the frame"
                    path="src/components/Setup/redesign/FinalConfirm/FinalConfirmArt.tsx"
                    description="The scan line runs while the passkey sheet is open."
                    code={`<ScanFrame scanLine={scanning && !reducedMotion} className="absolute inset-0">
    <MascotStage pose="too-cool" {...MASCOT} />
</ScanFrame>`}
                >
                    <ScanFrame scanLine className="flex h-44 w-36 items-center justify-center">
                        <PeanutMascot pose="too-cool" className="h-32 w-auto" />
                    </ScanFrame>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
