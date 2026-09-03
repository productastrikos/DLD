import React, { useEffect } from 'react';
import { IcoClose } from './icons';

export default function Modal({ open, title, subtitle, onClose, children, footer, width }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={width ? { width: `min(${width}px, 100%)` } : undefined}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--app-text)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11.5, color: 'var(--app-text-faint)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} title="Close"><IcoClose size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
