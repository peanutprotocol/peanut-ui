import Marquee from "react-fast-marquee";

export function MarqueeWrapper({
  children,
  backgroundColor,
  onClick,
}: {
  children: React.ReactNode;
  backgroundColor: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={
        onClick
          ? "cursor-pointer mx-auto w-full h-full max-h-15 italic items-center " +
            backgroundColor
          : "mx-auto w-full h-full max-h-15 italic items-center " +
            backgroundColor
      }
      onClick={onClick}
    >
      <Marquee autoFill speed={30}>
        <div className="flex flex-row items-center">{children}</div>
      </Marquee>
    </div>
  );
}
