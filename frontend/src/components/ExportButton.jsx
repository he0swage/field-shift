// Print / "Save as PDF" with a visible export state. The printable report lives in views/Report.jsx.
import { useEffect, useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { useT } from '../i18n/I18nContext';
import { useToast } from '../state/ToastContext';

export default function ExportButton({ label, className = 'btn btn-secondary', icon = 'print' }) {
  const IconC = icon === 'pdf' ? FileDown : Printer;
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!busy) return undefined;
    // Let the "Preparing…" state paint and the report charts lay out before opening the dialog
    const id = setTimeout(() => {
      window.print();
      setBusy(false);
      toast(t('export.done'));
    }, 700);
    return () => clearTimeout(id);
  }, [busy, t, toast]);

  return (
    <button type="button" className={className} onClick={() => setBusy(true)} disabled={busy} aria-live="polite">
      {busy ? <span className="spinner" aria-hidden="true" /> : <IconC size={16} aria-hidden="true" />}
      {busy ? t('export.preparing') : label}
    </button>
  );
}
