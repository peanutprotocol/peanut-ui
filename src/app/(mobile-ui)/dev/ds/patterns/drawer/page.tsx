'use client'

import { Button } from '@/components/0_Bruddle/Button'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Field } from '@/components/0_Bruddle/Field'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Icon } from '@/components/Global/Icons/Icon'
import {
    Drawer,
    DrawerContent,
    DrawerTitle,
    DrawerTrigger,
    DrawerHeader,
    DrawerDescription,
    DrawerClose,
} from '@/components/Global/Drawer'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

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
                                <DrawerDescription>
                                    This is a vaul-based bottom sheet. Swipe down to dismiss.
                                </DrawerDescription>
                            </DrawerHeader>
                            <div className="pb-4">
                                <p className="text-body-s text-foreground-secondary">
                                    The Drawer component wraps vaul and provides a consistent bottom-sheet experience.
                                    It includes an overlay, drag handle, and max-height constraint (80vh).
                                </p>
                                <div className="mt-4">
                                    <DrawerClose asChild>
                                        <Button variant="primary" shadowSize="4" className="w-full">
                                            Close Drawer
                                        </Button>
                                    </DrawerClose>
                                </div>
                            </div>
                        </DrawerContent>
                    </Drawer>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
  DrawerHeader,
  DrawerFooter,
  DrawerDescription,
  DrawerClose,
} from '@/components/Global/Drawer'`}
                    />

                    <CodeBlock
                        label="Basic Usage"
                        code={`<Drawer>
  <DrawerTrigger asChild>
    <Button variant="stroke">Open</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Title</DrawerTitle>
      <DrawerDescription>Description</DrawerDescription>
    </DrawerHeader>
    <div className="pb-4">
      {/* Content */}
    </div>
    <DrawerFooter>
      <DrawerClose asChild>
        <Button variant="primary" shadowSize="4" className="w-full">
          Done
        </Button>
      </DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>`}
                    />

                    <CodeBlock
                        label="Controlled"
                        code={`const [open, setOpen] = useState(false)

<Drawer open={open} onOpenChange={setOpen}>
  <DrawerContent>
    {/* Content */}
  </DrawerContent>
</Drawer>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            {/* Compound Components */}
            <DocSection title="Compound Components">
                <PropsTable
                    rows={[
                        {
                            name: 'Drawer',
                            type: 'Root',
                            default: '-',
                            description: 'Vaul root. Accepts open, onOpenChange, snapPoints, etc.',
                        },
                        {
                            name: 'DrawerTrigger',
                            type: 'Trigger',
                            default: '-',
                            description: 'Element that opens the drawer. Use asChild.',
                        },
                        {
                            name: 'DrawerContent',
                            type: 'Content',
                            default: '-',
                            description: 'Panel with overlay, drag handle, and an 80% viewport-height cap',
                        },
                        {
                            name: 'DrawerHeader',
                            type: 'Header',
                            default: '-',
                            description: 'Grid layout for title area',
                        },
                        {
                            name: 'DrawerTitle',
                            type: 'Title',
                            default: '-',
                            description: 'Accessible title (required for a11y)',
                        },
                        { name: 'DrawerDescription', type: 'Description', default: '-', description: 'Subtitle text' },
                        { name: 'DrawerFooter', type: 'Footer', default: '-', description: 'Bottom area for CTAs' },
                        {
                            name: 'DrawerClose',
                            type: 'Close',
                            default: '-',
                            description: 'Closes the drawer. Use asChild.',
                        },
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
                    Content is capped at 80% of the viewport height. For long lists, scrolling works inside the drawer.
                </DesignNote>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Home — Add and Send action drawers"
                    path="src/features/home/components/HomeActionDrawers.tsx"
                    description="Routing drawer: a centered title over a ListItem stack. Open state lives in the URL (?drawer=add|send), so the drawer is controlled, not triggered."
                    code={`<Drawer open={drawer !== null} onOpenChange={(isOpen) => !isOpen && setDrawer(null)} hideBottomNav>
  <DrawerContent className="pb-2">
    <div className="flex flex-col gap-4">
      <DrawerTitle className="text-center text-heading-s text-foreground-primary">
        {tNav(content)}
      </DrawerTitle>
      <div className="flex flex-col">
        {options.map((option, index, all) => (
          <ListItem
            key={option.key}
            position={getCardPosition(index, all.length)}
            leading={<Icon name={option.icon} size={24} className="text-foreground-primary" />}
            title={...}
            body={...}
            bodyWrap
            chevron
            onClick={() => navigate(option)}
          />
        ))}
      </div>
    </div>
  </DrawerContent>
</Drawer>`}
                >
                    <Drawer>
                        <DrawerTrigger asChild>
                            <Button variant="stroke" size="small">
                                Open example
                            </Button>
                        </DrawerTrigger>
                        <DrawerContent className="pb-2">
                            <div className="flex flex-col gap-4">
                                <DrawerTitle className="text-center text-heading-s text-foreground-primary">
                                    Add money
                                </DrawerTitle>
                                <div className="flex flex-col">
                                    <ListItem
                                        position="top"
                                        leading={<Icon name="bank" size={24} className="text-foreground-primary" />}
                                        title="Bank transfer"
                                        body="Send from your bank account in your local currency"
                                        bodyWrap
                                        chevron
                                        onClick={() => {}}
                                    />
                                    <ListItem
                                        position="bottom"
                                        leading={<Icon name="coins" size={24} className="text-foreground-primary" />}
                                        title="Crypto"
                                        body="Deposit USDC from a wallet or an exchange"
                                        bodyWrap
                                        chevron
                                        onClick={() => {}}
                                    />
                                </div>
                            </div>
                        </DrawerContent>
                    </Drawer>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Card — edit the spending limit"
                    path="src/components/Card/CardLimitEditDrawer.tsx"
                    description="Form drawer: header, one field, one CTA. dismissible={!saving} blocks the swipe and the overlay tap while the save is in flight."
                    code={`<Drawer
  open={isOpen}
  // a save in flight must not be abandoned by a swipe or overlay tap
  dismissible={!saving}
  onOpenChange={(open) => { if (!open && !saving) onClose() }}
>
  <DrawerContent>
    <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
      <DrawerTitle>{t('editTitle')}</DrawerTitle>
    </DrawerHeader>
    <Field label={label} htmlFor="card-limit-input" error={validationError}>
      <BaseInput id="card-limit-input" type="number" inputMode="decimal" value={value}
        onChange={(e) => setValue(e.target.value)}
        leftContent={<span className="text-foreground-secondary">$</span>} />
    </Field>
    <Button variant="primary" className="w-full justify-center" onClick={save} loading={saving}>
      {t('saveChanges')}
    </Button>
  </DrawerContent>
</Drawer>`}
                >
                    <Drawer>
                        <DrawerTrigger asChild>
                            <Button variant="stroke" size="small">
                                Open example
                            </Button>
                        </DrawerTrigger>
                        <DrawerContent>
                            <div className="flex flex-col items-center pt-1 pb-6 text-center">
                                <div className="mb-3 flex w-full flex-col items-center gap-4">
                                    <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                                        <DrawerTitle>Edit limit</DrawerTitle>
                                    </DrawerHeader>
                                </div>
                                <div className="flex w-full flex-col gap-4">
                                    <Field label="Monthly limit" htmlFor="ds-card-limit-example" className="text-left">
                                        <BaseInput
                                            id="ds-card-limit-example"
                                            type="number"
                                            inputMode="decimal"
                                            defaultValue="2500.00"
                                            leftContent={<span className="text-foreground-secondary">$</span>}
                                        />
                                    </Field>
                                    <DrawerClose asChild>
                                        <Button variant="primary" className="w-full justify-center">
                                            Save changes
                                        </Button>
                                    </DrawerClose>
                                </div>
                            </div>
                        </DrawerContent>
                    </Drawer>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
