import React, { useEffect } from 'react';

const PosToast = ({ message, type = "info", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  let bg = "bg-blue-500";
  if (type === "success") bg = "bg-green-500";
  if (type === "error") bg = "bg-red-500";
  if (type === "info") bg = "bg-blue-500";

  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow text-white ${bg} animate-fade-in`}
      style={{ minWidth: 200, textAlign: 'center' }}>
      {message}
    </div>
  );
};

export default PosToast;
