import { PeanutWavingHello } from '@/assets/mascot'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { NOTION_JOB_BOARD_URL, OPEN_ROLES } from '@/components/Jobs/openRoles'
import { RoleCard } from '@/components/Jobs/RoleCard'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import Image from 'next/image'
import Link from 'next/link'

// Company facts here are lifted from content/press/en.md (boilerplate + company_facts)
// and content/team/en.md (founders) in mono — the single source for how Peanut
// describes itself. Don't add a headcount, a funding number, an office, or a perk
// that isn't written down there. The team bios in that file are still placeholders,
// so only names and roles are used.
export function Careers() {
    return (
        <>
            <MarketingHero
                title="Work here."
                subtitle="One role open. Remote. Here's what you'd be walking into."
                ctaText=""
            />

            <MarketingShell>
                <div className="flex flex-col gap-12">
                    <section className="flex flex-col gap-4">
                        <h2 className="text-heading-xs text-foreground-primary">What Peanut is</h2>
                        <p className="text-body-m text-foreground-primary">
                            Peanut is a money app for people who cross borders. You send money to anyone, pay into local
                            systems like MercadoPago and PIX, and settle up with friends — instantly, without needing
                            local ID or a bank account. Bank transfers reach 40+ countries. It&apos;s invite-only for
                            now.
                        </p>
                        <p className="text-body-m text-foreground-secondary">
                            That&apos;s the product. The rest of this page is what it&apos;s like to work on it, and
                            what&apos;s open.
                        </p>
                    </section>

                    <section className="flex flex-col gap-4">
                        <h2 className="text-heading-xs text-foreground-primary">How the work works</h2>
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card className="gap-2 p-6">
                                <h3 className="text-label-l text-foreground-secondary">The product is live</h3>
                                <p className="text-body-s text-foreground-primary">
                                    Invite-only doesn&apos;t mean quiet. What you ship this week lands on people who are
                                    moving real money this week, in a currency that isn&apos;t the one they earn in.
                                </p>
                            </Card>
                            <Card className="gap-2 p-6">
                                <h3 className="text-label-l text-foreground-secondary">The map is the job</h3>
                                <p className="text-body-s text-foreground-primary">
                                    MercadoPago QR in Argentina. PIX in Brazil. Bank transfers in 40+ countries. Every
                                    market is another set of rails, another set of rules about ID and bank accounts, and
                                    another group of people who&apos;d rather not think about either.
                                </p>
                            </Card>
                            <Card className="gap-2 p-6">
                                <h3 className="text-label-l text-foreground-secondary">Who you&apos;d be joining</h3>
                                <p className="text-body-s text-foreground-primary">
                                    Hugo Montenegro and Konrad co-founded Peanut. Peanut is a trading name of Squirrel
                                    Labs Ltd, registered in England &amp; Wales (No. 14558823).
                                </p>
                            </Card>
                        </div>
                        <p className="text-body-s text-foreground-secondary">
                            The bar for everything we build is one line:{' '}
                            <span className="text-body-s-semibold text-foreground-primary">
                                pay like a local, anywhere.
                            </span>
                        </p>
                    </section>

                    <section className="flex flex-col gap-4">
                        <h2 className="text-heading-xs text-foreground-primary">Open roles</h2>
                        {OPEN_ROLES.length > 0 ? (
                            <>
                                <p className="text-body-s text-foreground-secondary">
                                    We&apos;d rather list one real job than pad the page. Here it is.
                                </p>
                                <div className="flex flex-col gap-4">
                                    {OPEN_ROLES.map((role) => (
                                        <RoleCard key={role.slug} role={role} />
                                    ))}
                                </div>
                            </>
                        ) : (
                            <Card className="gap-2 p-6">
                                <h3 className="text-heading-card text-foreground-primary">
                                    Nothing&apos;s open right now.
                                </h3>
                                <p className="text-body-s text-foreground-primary">
                                    That changes without much warning, and this page is the first place it shows up. If
                                    you already know what you&apos;d take on here, the board is open either way — tell
                                    us and we&apos;ll read it.
                                </p>
                            </Card>
                        )}
                    </section>

                    <section className="flex flex-col gap-4">
                        <div className="flex items-start gap-4">
                            <Image
                                src={PeanutWavingHello}
                                alt=""
                                unoptimized
                                className="hidden h-24 w-auto shrink-0 sm:block"
                            />
                            <div className="flex flex-col gap-2">
                                <h2 className="text-heading-xs text-foreground-primary">Ready?</h2>
                                <p className="text-body-m text-foreground-primary">
                                    Applications go through our Notion board — that&apos;s the only place we read them.
                                    Skip the cover letter. Tell us what you&apos;d do in your first month.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 sm:max-w-sm">
                            <Button href={NOTION_JOB_BOARD_URL} external shadowSize="4" className="w-full">
                                Apply on Notion
                            </Button>
                            <Button variant="stroke" href="/lp" className="w-full">
                                See what we&apos;ve built
                            </Button>
                        </div>
                        <p className="text-body-s text-foreground-secondary">
                            Curious first? Read the{' '}
                            <Link href="/en/press" className="text-foreground-primary underline">
                                press kit
                            </Link>{' '}
                            or poke around{' '}
                            <Link href="/en/help" className="text-foreground-primary underline">
                                the help centre
                            </Link>
                            .
                        </p>
                    </section>
                </div>
            </MarketingShell>
        </>
    )
}
