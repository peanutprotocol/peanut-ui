export function CardWrapper({
  children,
  mb = " mb-48 ",
  mt = " mt-5 ",
  shadow = true,
}: {
  children: React.ReactNode;
  mb?: string;
  mt?: string;
  shadow?: boolean;
}) {
  return (
    <div
      className={
        "flex flex-col items-center center-xy py-6 px-4 w-10/12 lg:w-2/3 xl:w-1/2 brutalborder bg-white mx-auto  text-black relative " +
        mb +
        mt
      }
      id={shadow ? "cta-div" : ""}
    >
      {" "}
      {children}
    </div>
  );
}
