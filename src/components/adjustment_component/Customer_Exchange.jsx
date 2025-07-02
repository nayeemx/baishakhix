import React, { useEffect } from "react";

const Customer_Exchange = ({ onOpen }) => {
  useEffect(() => {
    if (onOpen) onOpen();
  }, [onOpen]);

  return <div>Customer Exchange Page</div>;
};

export default Customer_Exchange;