'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

type Tone = 'warning' | 'success' | 'info';
type NoticeItem = { tone: Tone; title: string; content: ReactNode };

const TONE_STYLES: Record<Tone, { button: string; panel: string; tag: string }> = {
  warning: {
    button: 'border-[#ff7896]/70 bg-[#ed174b]/10 text-[#b3133b] hover:bg-[#ed174b]/15',
    panel: 'border-[#ff7896]/60 bg-[#fff6f8] text-[#7d1230]',
    tag: 'border-[#ff7896]/70 bg-[#ed174b]/10 text-[#b3133b]',
  },
  success: {
    button: 'border-[#58A9E3]/50 bg-[#EAF5FC] text-[#005A9C] hover:bg-[#F4FAFE]',
    panel: 'border-[#58A9E3]/50 bg-[#F4FAFE] text-[#17476B]',
    tag: 'border-[#58A9E3]/50 bg-[#EAF5FC] text-[#005A9C]',
  },
  info: {
    button: 'border-[#58A9E3]/50 bg-[#EAF5FC] text-[#005A9C] hover:bg-[#F4FAFE]',
    panel: 'border-[#58A9E3]/50 bg-[#F4FAFE] text-[#17476B]',
    tag: 'border-[#58A9E3]/50 bg-[#EAF5FC] text-[#005A9C]',
  },
};

export function StatusNotice({
  notices,
}: {
  notices: NoticeItem[];
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const buttonTone = notices.some((notice) => notice.tone === 'warning') ? 'warning' : 'info';
  const buttonStyles = TONE_STYLES[buttonTone];
  const titleId = 'status-notice-radar-title';

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Ver ${notices.length} ${notices.length === 1 ? 'aviso' : 'avisos'} do radar`}
        title="Avisos do radar"
        onClick={() => setOpen(true)}
        className={`relative inline-flex h-14 w-14 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005A9C]/40 ${buttonStyles.button}`}
      >
        <AlertTriangle aria-hidden="true" className="h-7 w-7" />
        <span className={`absolute -right-1.5 -top-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none text-white shadow-sm ${buttonTone === 'warning' ? 'bg-[#ed174b]' : 'bg-[#005A9C]'}`}>
          {notices.length}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            aria-labelledby={titleId}
            aria-modal="true"
            role="dialog"
            className="w-full max-w-md rounded-2xl border border-[#58A9E3]/40 bg-white p-5 text-court-text shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full border border-[#58A9E3]/50 bg-[#EAF5FC] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#005A9C]">
                  {notices.length} {notices.length === 1 ? 'informação' : 'informações'}
                </span>
                <h2 id={titleId} className="mt-3 text-lg font-bold text-[#005A9C]">
                  Avisos do radar
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label="Fechar aviso"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#58A9E3]/40 bg-white text-lg text-[#005A9C] transition-colors hover:bg-[#F4FAFE]"
              >
                ×
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {notices.map((notice, index) => {
                const noticeStyles = TONE_STYLES[notice.tone];
                return (
                  <div key={`${notice.title}-${index}`} className={`rounded-xl border p-3 ${noticeStyles.panel}`}>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${noticeStyles.tag}`}>
                      {notice.title}
                    </span>
                    <div className="mt-2 text-sm leading-6">{notice.content}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
