interface SectionProps {
    title: string
    children: React.ReactNode
    id?: string
}

export function Section({ title, children, id }: SectionProps) {
    return (
        <section id={id} className="py-10 md:py-14">
            <h2 className="mb-6 text-h2 font-bold md:text-h1">{title}</h2>
            {children}
        </section>
    )
}
