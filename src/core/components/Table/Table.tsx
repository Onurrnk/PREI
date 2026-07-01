import React from 'react';
import styles from './Table.module.css';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ children, className = '', ...props }) => {
  return (
    <div className={styles.tableContainer}>
      <table className={`${styles.table} ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
};

export const TableHead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, ...props }) => {
  return <thead className={styles.thead} {...props}>{children}</thead>;
};

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, ...props }) => {
  return <tbody className={styles.tbody} {...props}>{children}</tbody>;
};

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ children, className = '', ...props }) => {
  return <tr className={`${styles.tr} ${className}`} {...props}>{children}</tr>;
};

export const TableHeader: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ children, className = '', ...props }) => {
  return <th className={`${styles.th} ${className}`} {...props}>{children}</th>;
};

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ children, className = '', ...props }) => {
  return <td className={`${styles.td} ${className}`} {...props}>{children}</td>;
};
