// Feedback toasts with optional Undo (HCI: visible status + user control).
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useT } from '../i18n/I18nContext';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const t = useT();
  const [toast, setToast] = useState(null);
  const timer = useRef();

  const show = useCallback((message, undo) => {
    clearTimeout(timer.current);
    setToast({ message, undo });
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Always mounted so screen readers announce changes */}
      <div className={`toast${toast ? '' : ' hidden'}`} role="status" aria-live="polite">
        <span>{toast?.message}</span>
        {toast?.undo && (
          <button type="button" onClick={() => { toast.undo(); setToast(null); }}>{t('common.undo')}</button>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
