// =====================================================================
// PREI | Form primitives — etiket üstte, hata altta (Design System §4.6).
// Placeholder-as-label yasak; her alan Field ile sarılır.
// =====================================================================
import React from 'react';
import styles from './Form.module.css';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, hint, error, children }) => (
  <div className={styles.field}>
    <label className={styles.label}>{label}</label>
    {children}
    {hint && !error && <span className={styles.hint}>{hint}</span>}
    {error && <span className={styles.error}>{error}</span>}
  </div>
);

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ invalid, className, ...rest }, ref) => (
    <input
      ref={ref}
      className={`${styles.control} ${invalid ? styles.controlError : ''} ${className ?? ''}`}
      {...rest}
    />
  ),
);
Input.displayName = 'Input';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ invalid, className, children, ...rest }, ref) => (
    <select
      ref={ref}
      className={`${styles.control} ${invalid ? styles.controlError : ''} ${className ?? ''}`}
      {...rest}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ invalid, className, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={`${styles.control} ${invalid ? styles.controlError : ''} ${className ?? ''}`}
      {...rest}
    />
  ),
);
Textarea.displayName = 'Textarea';

/** İki kolonlu form satırı; mobilde tek kolona düşer. */
export const FormRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className={styles.row}>{children}</div>
);
