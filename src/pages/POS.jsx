import PosCart from "../components/poscomponents/PosCart";
import PosProduct from "../components/poscomponents/PosProduct";

const POS = () => {
  return (
    <>
    {/* <div className="flex justify-between gap-2"> */}
    <div className="flex flex-col-reverse md:flex-row gap-2 w-full h-full">
      <div className="md:w-[76%] w-full">
        <PosProduct />
      </div>
      <div className="md:w-[24%] w-full my-2 md:my-0 overflow-auto">
        <PosCart />
      </div>
    </div>
    </>
  );
};

export default POS;