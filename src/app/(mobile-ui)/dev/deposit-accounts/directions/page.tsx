'use client'

import { BulletList } from '@/components/0_Bruddle/BulletList'
import { Notification } from '@/components/0_Bruddle/Notification'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import Card from '@/components/Global/Card'
import Link from 'next/link'
import DevNoteCard from '../../_components/DevNoteCard'
import DevPageShell from '../../_components/DevPageShell'
import DevSectionLabel from '../../_components/DevSectionLabel'
import { DIRECTION_QUESTIONS } from './_components/directions'

/**
 * The open product questions behind the deposit-accounts flow.
 *
 * The prototype answers each one in code, because a prototype has to pick
 * something to render. This page says which answer it picked, what the other
 * answers would cost, and which of them is a real alternative rather than a
 * worse version of the same idea.
 */
export default function DepositAccountDirectionsPage() {
    return (
        <DevPageShell
            title="Deposit accounts — product directions"
            description="What the prototype decided, what it did not, and what each alternative costs."
            backHref="/dev/deposit-accounts"
            width="prose"
            actions={
                <Link href="/dev/deposit-accounts" className="text-body-s underline">
                    Open the flow
                </Link>
            }
        >
            <div className="flex flex-col gap-8">
                <Notification priority="info" title="What is already settled by the data">
                    Bridge sandbox answers three questions that used to be design work. There is no payment reference on
                    any corridor. The holder name is the user on EUR, USD and MXN and Bridge&apos;s own entity on GBP,
                    so it is read per account. Argentina and Brazil stay on Manteca, where the account is the
                    provider&apos;s and only the user&apos;s own bank may pay in — so neither can be handed to an
                    employer.
                </Notification>

                {DIRECTION_QUESTIONS.map((question) => (
                    <section key={question.id} className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <DevSectionLabel>{question.question}</DevSectionLabel>
                            <p className="text-body-s text-foreground-secondary">{question.stake}</p>
                        </div>

                        <div className="flex flex-col gap-3">
                            {question.options.map((option) => (
                                <Card key={option.key} className="flex flex-col gap-2 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="text-heading-card text-foreground-primary">
                                            {option.key} · {option.title}
                                        </h3>
                                        {option.recommended && <StatusBadge status="completed" customText="Built" />}
                                    </div>
                                    <p className="text-body-s text-foreground-primary">{option.summary}</p>
                                    <p className="text-body-xs text-foreground-secondary">{option.cost}</p>
                                </Card>
                            ))}
                        </div>

                        <p className="text-body-xs text-foreground-secondary">{question.built}</p>
                    </section>
                ))}

                <DevNoteCard title="Still owed by somebody other than the UI">
                    <BulletList
                        size="xs"
                        items={[
                            'The Virtual Accounts SKU is not_allowed in production. Every screen here runs on sandbox until Bridge enables it.',
                            'A returned payment needs the refund reconciliation job. Without it the returned state never fires.',
                            'The third-party cap is proved for USD only. Other corridors say nothing until Bridge confirms a number.',
                            'GBP is pooled in sandbox. If it is also pooled in production, UK users hand out a name that is not theirs — worth asking Bridge before launch.',
                        ]}
                    />
                </DevNoteCard>
            </div>
        </DevPageShell>
    )
}
