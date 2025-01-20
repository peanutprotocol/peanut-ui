import Icon from '@/components/Global/Icon'

export const ReferenceAndAttachment = ({
    reference,
    attachmentUrl,
}: {
    reference?: string | null
    attachmentUrl?: string | null
}) => {
    if (!reference && !attachmentUrl) return null
    return (
        <>
            <div className={`flex w-full flex-col items-center justify-center  gap-2`}>
                {reference && (
                    <label className="max-w-full text-h8">
                        Ref: <span className="font-normal"> {reference} </span>
                    </label>
                )}
                {attachmentUrl && (
                    <a
                        href={attachmentUrl}
                        download
                        target="_blank"
                        className="flex w-full cursor-pointer flex-row items-center justify-center gap-1 text-h9 font-normal text-grey-1 underline "
                    >
                        <Icon name={'download'} />
                        Download attachment
                    </a>
                )}
            </div>
            <div className="flex w-full border-t border-dotted border-black" />
        </>
    )
}
