import type { HTMLAttributes, FC } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: FC<CardProps> = ({ 
  children, 
  padding = 'md',
  className = '',
  ...props 
}) => {
  return (
    <div className={`${styles.card} ${styles[`padding-${padding}`]} ${className}`} {...props}>
      {children}
    </div>
  );
};

// Sub-sections accept an optional `padding` override (defaults to their own).
export interface CardSectionProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClass = (padding?: CardSectionProps['padding']) =>
  padding ? styles[`padding-${padding}`] : '';

export const CardHeader: FC<CardSectionProps> = ({ children, padding, className = '', ...props }) => (
  <div className={`${styles.header} ${paddingClass(padding)} ${className}`} {...props}>{children}</div>
);

export const CardBody: FC<CardSectionProps> = ({ children, padding, className = '', ...props }) => (
  <div className={`${styles.body} ${paddingClass(padding)} ${className}`} {...props}>{children}</div>
);

export const CardFooter: FC<CardSectionProps> = ({ children, padding, className = '', ...props }) => (
  <div className={`${styles.footer} ${paddingClass(padding)} ${className}`} {...props}>{children}</div>
);
