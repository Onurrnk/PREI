import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudArrowUp, FilmStrip, FileText, Image as ImageIcon, File as FileIcon, X } from '@phosphor-icons/react';
import styles from './UploadZone.module.css';

export type UploadZoneKind = 'image' | 'video' | 'document' | 'any';

interface UploadZoneProps {
  kind?: UploadZoneKind;
  /** input accept değeri, örn. "image/jpeg,image/png" */
  accept?: string;
  /** Zon içindeki ana cümle */
  prompt: string;
  /** Format/limit ipucu, örn. "JPG, PNG (Max 10MB / dosya)" */
  hint: string;
  multiple?: boolean;
  onFilesChange?: (files: File[]) => void;
}

const kindIcon = (kind: UploadZoneKind, size: number) => {
  switch (kind) {
    case 'video': return <FilmStrip size={size} />;
    case 'document': return <FileText size={size} />;
    case 'image': return <ImageIcon size={size} />;
    default: return <CloudArrowUp size={size} />;
  }
};

const fileIcon = (type: string) => {
  if (type.startsWith('video/')) return <FilmStrip size={16} />;
  if (type.startsWith('image/')) return <ImageIcon size={16} />;
  if (type.includes('pdf') || type.includes('sheet') || type.includes('excel') || type.includes('word')) return <FileText size={16} />;
  return <FileIcon size={16} />;
};

const formatSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/**
 * Sürükle-bırak + dosya seçici + kuyruk listesi olan yükleme alanı.
 * DS uyumu: border-subtle üzerinde dashed, sürüklemede brand vurgusu,
 * kuyrukta tip ikonu + mono boyut + kaldırma. (Mock: dosyalar yalnız state'te.)
 */
export const UploadZone: React.FC<UploadZoneProps> = ({
  kind = 'any', accept, prompt, hint, multiple = true, onFilesChange,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  const update = (next: File[]) => {
    setFiles(next);
    onFilesChange?.(next);
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const added = Array.from(incoming);
    update(multiple ? [...files, ...added] : added.slice(0, 1));
  };

  const removeAt = (idx: number) => update(files.filter((_, i) => i !== idx));

  const openPicker = () => inputRef.current?.click();

  return (
    <div>
      <div
        className={`${styles.zone} ${isDragging ? styles.dragging : ''}`}
        role="button"
        tabIndex={0}
        aria-label={prompt}
        onClick={openPicker}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } }}
        onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setIsDragging(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) { dragDepth.current = 0; setIsDragging(false); }
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setIsDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <span className={styles.zoneIcon}>{kindIcon(kind, 32)}</span>
        <p className={styles.prompt}>{isDragging ? t('common.upload.dropFiles') : prompt}</p>
        <span className={styles.hint}>{hint}</span>
        <span className={styles.browse}>{t('common.upload.browseFiles')}</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className={styles.input}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {files.length > 0 && (
        <ul className={styles.queue}>
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className={styles.queueItem}>
              <span className={styles.fileIcon}>{fileIcon(f.type)}</span>
              <span className={styles.fileName} title={f.name}>{f.name}</span>
              <span className={styles.fileSize}>{formatSize(f.size)}</span>
              <button
                type="button"
                className={styles.remove}
                aria-label={t('common.upload.remove', { name: f.name })}
                onClick={() => removeAt(i)}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
