import React, { useState, useEffect } from "react";
import Customer_Exchange from "./Customer_Exchange";
import Customer_Due from "./Customer_Due";

const Modal = ({ children, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded shadow-lg w-10/12 h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="mb-4 px-2 py-1 bg-red-500 text-white rounded float-right"
          onClick={onClose}
        >
          X
        </button>
        {children}
      </div>
    </div>
  );
};

const Customer_Adjustment = () => {
  const [modal, setModal] = useState(null); // 'exchange' | 'due' | null

  return (
    <div className="space-y-4">
      <button
        onClick={() => setModal("exchange")}
        className="bg-blue-500 text-white px-4 py-2 rounded w-full hover:bg-blue-600"
      >
        Exchange
      </button>

      <button
        onClick={() => setModal("due")}
        className="bg-green-500 text-white px-4 py-2 rounded w-full hover:bg-green-600"
      >
        Due
      </button>

      {modal === "exchange" && (
        <Modal onClose={() => setModal(null)}>
          <Customer_Exchange onOpen={() => console.log("Exchange modal opened")} />
        </Modal>
      )}

      {modal === "due" && (
        <Modal onClose={() => setModal(null)}>
          <Customer_Due onOpen={() => console.log("Due modal opened")} />
        </Modal>
      )}
    </div>
  );
};

export default Customer_Adjustment;