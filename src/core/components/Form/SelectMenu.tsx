import React, { useEffect, useId, useRef, useState } from 'react';
import { CaretDown, Check } from '@phosphor-icons/react';
import styles from './SelectMenu.module.css';

export interface SelectMenuOption {
  value: string;
  label: string;
}

interface SelectMenuProps {
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * Custom açılır seçim — native <select>'in premium karşılığı.
 * DS: tetik form .control diliyle; menü yüzen katman (surface-raised +
 * shadow-raised, scale 0.98→1 fade); seçili satırda Check + marka rengi.
 * Klavye: Enter/Space aç, ok tuşları gez, Enter seç, Esc kapat.
 */
export const SelectMenu: React.FC<SelectMenuProps> = ({
  value, options, onChange, placeholder = 'Select…', disabled, 'aria-label': ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex(o => o.value === value);
      setActiveIdx(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  useEffect(() => {
    if (open && activeIdx >= 0) {
      listRef.current?.children[activeIdx]?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeIdx]);

  const commit = (idx: number) => {
    const opt = options[idx];
    if (opt) onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open && activeIdx >= 0) commit(activeIdx); else setOpen(true);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) setOpen(true);
        else setActiveIdx(i => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) setActiveIdx(i => Math.max(0, i - 1));
        break;
      case 'Home':
        if (open) { e.preventDefault(); setActiveIdx(0); }
        break;
      case 'End':
        if (open) { e.preventDefault(); setActiveIdx(options.length - 1); }
        break;
      case 'Escape':
        if (open) { e.preventDefault(); setOpen(false); }
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? styles.value : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </span>
        <CaretDown size={14} className={`${styles.caret} ${open ? styles.caretOpen : ''}`} />
      </button>

      {open && (
        <ul id={listboxId} role="listbox" className={styles.menu} ref={listRef}>
          {options.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`${styles.option} ${i === activeIdx ? styles.optionActive : ''} ${opt.value === value ? styles.optionSelected : ''}`}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(i)}
            >
              <span className={styles.optionLabel}>{opt.label}</span>
              {opt.value === value && <Check size={14} className={styles.check} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
