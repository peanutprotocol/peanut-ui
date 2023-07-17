import Marquee from "react-fast-marquee";

export function MarqueeSdk({
  children,
  backgroundColor,
}: {
  children: React.ReactNode;
  backgroundColor: string;
}) {
  return (
    <div
      className={
        "mx-auto w-full h-full max-h-15 italic items-center cursor-pointer " +
        backgroundColor
      }
    >
      <Marquee autoFill speed={30}>
        <div className="flex flex-row items-center gap-2 mr-1">{children}</div>
      </Marquee>
    </div>
  );
}
