export function CardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center center-xy py-6 px-4 w-10/12 lg:w-2/3 xl:w-1/2 brutalborder bg-white mx-auto mt-5 mb-48 text-black relative">
      {" "}
      {children}
    </div>
  );
}
