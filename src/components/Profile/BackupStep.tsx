/** One row of the platform backup sequence: bold step name over its detail. */
export const BackupStep = ({ title, description }: { title: string; description: string }) => (
    <>
        <p className="font-bold text-foreground-primary">{title}</p>
        <p className="text-body-s text-foreground-primary">{description}</p>
    </>
)
