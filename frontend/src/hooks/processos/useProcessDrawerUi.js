import React from "react";

export function useProcessDrawerUi({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = React.useState("dados");

  React.useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (!isOpen) {
      setActiveTab("dados");
    }
  }, [isOpen]);

  return { activeTab, setActiveTab };
}
