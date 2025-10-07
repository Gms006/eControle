import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const ToastContext = createContext();

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toastTimeoutsRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const stored = toastTimeoutsRef.current.get(id);
    if (stored) {
      clearTimeout(stored);
      toastTimeoutsRef.current.delete(id);
    }
  }, []);

  const enqueueToast = useCallback(
    (message) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((prev) => [...prev, { id, message }]);
      if (typeof window !== "undefined") {
        const timeout = window.setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
          const stored = toastTimeoutsRef.current.get(id);
          if (stored) {
            clearTimeout(stored);
            toastTimeoutsRef.current.delete(id);
          }
        }, 3200);
        toastTimeoutsRef.current.set(id, timeout);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      toastTimeoutsRef.current.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      toasts,
      enqueueToast,
      dismissToast,
    }),
    [dismissToast, enqueueToast, toasts],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export default ToastProvider;
