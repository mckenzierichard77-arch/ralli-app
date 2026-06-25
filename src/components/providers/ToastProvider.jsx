import React from "react";
import { ToastViewport } from "../ui/Toast.jsx";

export const ToastContext = React.createContext({ toast: () => {} });

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);
  const idRef = React.useRef(0);

  const dismiss = React.useCallback((id) => {
    setToasts(ts => ts.filter(t => t.id !== id));
  }, []);

  const toast = React.useCallback((message, kind = "info") => {
    const id = ++idRef.current;
    const ttl = (kind === "error" || kind === "warning") ? 5000 : 3500;
    setToasts(ts => [...ts, { id, message, kind }]);
    setTimeout(() => dismiss(id), ttl);
    return id;
  }, [dismiss]);

  // Make available globally as a backstop for non-component code (Firestore handlers, async functions outside React).
  React.useEffect(() => {
    window.__ralli_toast = toast;
    return () => { delete window.__ralli_toast; };
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
