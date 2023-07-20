import closeIcon from "@/assets/icons8-close.svg";
interface IModalWrapperProps {
  children: React.ReactNode;
  headerText: string;
  onClose: () => void;
  isOpen: boolean;
}

export function ModalWrapper({
  children,
  headerText,
  onClose,
  isOpen = false,
}: IModalWrapperProps) {
  return (
    <>
      {isOpen && (
        <div
          onClick={() => {
            onClose();
          }}
          className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 z-50 flex items-center justify-center text-black"
        >
          <div className="bg-white w-11/12 md:w-1/2 lg:w-1/3 p-4 rounded-lg shadow-lg">
            {/* header */}
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold">{headerText}</h3>
              <img
                src={closeIcon.src}
                alt="close"
                className="h-6 cursor-pointer -mt-10"
              />
            </div>
            {/* content */}
            {children}
          </div>
        </div>
      )}
    </>
  );
}
