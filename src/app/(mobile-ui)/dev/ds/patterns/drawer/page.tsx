'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger, DrawerHeader, DrawerFooter, DrawerDescription, DrawerClose } from '@/components/Global/Drawer'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function DrawerPage() {
    return (
        <DocPage>
            <DocHeader
                title="Drawer"
                description="Vaul-based bottom sheet with compound component API. Swipe-to-dismiss, snap points, and overlay."
                status="production"
            />

            {/* Live Demo + Usage */}
            <DocSection title="Live Example">
                <DocSection.Content>
                    <Drawer>
                        <DrawerTrigger asChild>
                            <Button variant="stroke">Open Drawer</Button>
                        </DrawerTrigger>
                        <DrawerContent>
                            <DrawerHeader>
                                <DrawerTitle>Example Drawer</DrawerTitle>
                                <DrawerDescription>This is a vaul-based bottom sheet. Swipe down to dismiss.</DrawerDescription>
                            </DrawerHeader>
                            <div className="px-4 pb-4">
                                <p className="text-sm text-grey-1">
                                    The Drawer component wraps vaul and provides a consistent bottom-sheet experience.
                                    It includes an overlay, drag handle, and max-height constraint (80vh).
                                </p>
                                <div className="mt-4">
                                    <DrawerClose asChild>
                                        <Button variant="purple" shadowSize="4" className="w-full">
                                            Close Drawer
                                        </Button>
                                    </DrawerClose>
                                </div>
                            </div>
                        </DrawerContent>
                    </Drawer>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
  DrawerHeader,
  DrawerFooter,
  DrawerDescription,
  DrawerClose,
} from '@/components/Global/Drawer'`} />

                    <CodeBlock label="Basic Usage" code={`<Drawer>
  <DrawerTrigger asChild>
    <Button variant="stroke">Open</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Title</DrawerTitle>
      <DrawerDescription>Description</DrawerDescription>
    </DrawerHeader>
    <div className="px-4 pb-4">
      {/* Content */}
    </div>
    <DrawerFooter>
      <DrawerClose asChild>
        <Button variant="purple" shadowSize="4" className="w-full">
          Done
        </Button>
      </DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>`} />

                    <CodeBlock label="Controlled" code={`const [open, setOpen] = useState(false)

<Drawer open={open} onOpenChange={setOpen}>
  <DrawerContent>
    {/* Content */}
  </DrawerContent>
</Drawer>`} />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            {/* Compound Components */}
            <DocSection title="Compound Components">
                <PropsTable
                    rows={[
                        { name: 'Drawer', type: 'Root', default: '-', description: 'Vaul root. Accepts open, onOpenChange, snapPoints, etc.' },
                        { name: 'DrawerTrigger', type: 'Trigger', default: '-', description: 'Element that opens the drawer. Use asChild.' },
                        { name: 'DrawerContent', type: 'Content', default: '-', description: 'Panel with overlay, drag handle, max-h-[80vh]' },
                        { name: 'DrawerHeader', type: 'Header', default: '-', description: 'Grid layout for title area' },
                        { name: 'DrawerTitle', type: 'Title', default: '-', description: 'Accessible title (required for a11y)' },
                        { name: 'DrawerDescription', type: 'Description', default: '-', description: 'Subtitle text' },
                        { name: 'DrawerFooter', type: 'Footer', default: '-', description: 'Bottom area for CTAs' },
                        { name: 'DrawerClose', type: 'Close', default: '-', description: 'Closes the drawer. Use asChild.' },
                    ]}
                />
            </DocSection>

            {/* Design Notes */}
            <DocSection title="Design Rules">
                <DesignNote type="info">
                    Always include a DrawerTitle inside DrawerContent for accessibility (screen readers).
                </DesignNote>
                <DesignNote type="info">
                    Drawer scales the background by default (shouldScaleBackground=true). The drag handle is a 40px wide
                    rounded bar at the top.
                </DesignNote>
                <DesignNote type="warning">
                    Content is capped at max-h-[80vh] with overflow-auto. For long lists, scrolling works inside the drawer.
                </DesignNote>
            </DocSection>
        </DocPage>
    )
}
