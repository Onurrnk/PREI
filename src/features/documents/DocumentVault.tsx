import React, { useState } from 'react';
import type { VaultDocumentDTO } from '../../core/types';
import { documentsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { UploadZone } from '../../core/components/Form/UploadZone';
import { Folder, FileText, Image as ImageIcon, FileXls, CloudArrowUp, MagnifyingGlass, DotsThreeVertical, DownloadSimple, Trash, FolderOpen } from '@phosphor-icons/react';
import styles from './DocumentVault.module.css';

const FOLDERS = ['Root', 'Client KYC', 'Contracts', 'Marketing', 'Developer Agreements'];

export interface DocumentVaultProps {
  clientId?: string;
}

export const DocumentVault: React.FC<DocumentVaultProps> = ({ clientId }) => {
  const { data, loading, refetch } = useFetch<VaultDocumentDTO[]>(() => documentsApi.list(), [clientId]);
  const documents = clientId
    ? (data ?? []).filter(d => d.relatedId === clientId || d.folder === 'Client KYC')
    : (data ?? []);
  const [currentFolder, setCurrentFolder] = useState<string>('Root');
  const [searchQuery, setSearchQuery] = useState('');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<VaultDocumentDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Hook'lar her render'da aynı sırada çağrılmalı; koşullu return'lerden önce durur.
  const toast = useToast();

  if (loading) return <TableSkeleton rows={6} />;

  const filteredDocs = documents.filter(doc => {
    const matchesFolder = doc.folder === currentFolder;
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  const getFileIcon = (type: string) => {
    switch(type) {
      case 'pdf': return <FileText size={32} className={styles.iconPdf} />;
      case 'image': return <ImageIcon size={32} className={styles.iconImage} />;
      case 'excel': return <FileXls size={32} className={styles.iconExcel} />;
      case 'word': return <FileText size={32} className={styles.iconWord} />;
      default: return <FileText size={32} className={styles.iconDefault} />;
    }
  };

  const handleUploadClick = () => {
    setPendingFiles([]);
    setShowUploadModal(true);
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) {
      toast.error('Önce dosya seçin.');
      return;
    }
    setIsUploading(true);
    try {
      for (const file of pendingFiles) {
        await documentsApi.upload(file, currentFolder);
      }
      toast.success(`${pendingFiles.length} dosya ${currentFolder === 'Root' ? 'Root' : currentFolder} klasörüne yüklendi`);
      setShowUploadModal(false);
      setPendingFiles([]);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yükleme başarısız.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (doc: VaultDocumentDTO) => {
    try {
      const { url } = await documentsApi.downloadUrl(doc.id);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İndirme bağlantısı alınamadı.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await documentsApi.remove(deleteTarget.id);
      toast.success('Dosya silindi.');
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silme başarısız.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Document Management Center</h1>
          <p className={styles.subtitle}>Securely store, organize, and share your real estate documents.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchBar}>
            <MagnifyingGlass size={16} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search documents..." 
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="primary" onClick={handleUploadClick}>
            <CloudArrowUp size={16} style={{marginRight: 8}} /> 
            Upload File
          </Button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Folder Sidebar */}
        <div className={styles.sidebar}>
          <Card className={styles.foldersCard}>
            <CardHeader><h3 className={styles.cardTitle}>Vault Folders</h3></CardHeader>
            <CardBody className={styles.folderList}>
              {FOLDERS.map(folder => (
                <div 
                  key={folder} 
                  className={`${styles.folderItem} ${currentFolder === folder ? styles.activeFolder : ''}`}
                  onClick={() => { setCurrentFolder(folder); setSearchQuery(''); }}
                >
                  {currentFolder === folder ? <FolderOpen size={18} /> : <Folder size={18} />}
                  <span>{folder === 'Root' ? 'All Files (Root)' : folder}</span>
                  <span className={styles.folderCount}>
                    {documents.filter(d => d.folder === folder).length}
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
          
          <Card className={styles.storageCard}>
            <CardBody>
              <div className={styles.storageHeader}>
                <strong>Storage Usage</strong>
                {/* Gerçek toplam — vault'taki dosyaların boyutundan; sahte kota yok */}
                <span>
                  {(() => {
                    const totalMB = documents.reduce((s, d) => s + d.sizeMB, 0);
                    return totalMB >= 1024
                      ? `${(totalMB / 1024).toFixed(1)} GB`
                      : `${totalMB.toFixed(1)} MB`;
                  })()} · {documents.length} dosya
                </span>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* File Grid */}
        <div className={styles.mainArea}>
          <div className={styles.mainAreaHeader}>
            <h2 className={styles.currentFolderName}>{currentFolder === 'Root' ? 'All Files' : currentFolder}</h2>
            <span className={styles.fileCountText}>{filteredDocs.length} files</span>
          </div>

          {filteredDocs.length === 0 ? (
            <div className={styles.emptyState}>
              <FolderOpen size={48} className={styles.emptyIcon} />
              <p>This folder is empty.</p>
              <Button variant="outline" onClick={handleUploadClick}>Upload your first file here</Button>
            </div>
          ) : (
            <div className={styles.fileGrid}>
              {filteredDocs.map(doc => (
                <div key={doc.id} className={styles.fileCard}>
                  <div className={styles.fileCardHeader}>
                    {getFileIcon(doc.type)}
                    <button className={styles.moreBtn}><DotsThreeVertical size={16} /></button>
                  </div>
                  <div className={styles.fileCardBody}>
                    <h4 className={styles.fileName} title={doc.name}>{doc.name}</h4>
                    <p className={styles.fileMeta}>{doc.sizeMB} MB • {doc.uploadedAt}</p>
                  </div>
                  <div className={styles.fileCardFooter}>
                    <button className={styles.actionBtn} title="Download" onClick={() => handleDownload(doc)}>
                      <DownloadSimple size={14} />
                    </button>
                    <button className={styles.actionBtn} title="Delete" onClick={() => setDeleteTarget(doc)}>
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title={`Upload to ${currentFolder}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowUploadModal(false)} disabled={isUploading}>Cancel</Button>
            <Button variant="primary" onClick={handleUpload} disabled={isUploading || pendingFiles.length === 0}>
              {isUploading ? 'Uploading…' : `Upload ${pendingFiles.length > 0 ? `(${pendingFiles.length}) ` : ''}Files`}
            </Button>
          </>
        }
      >
        <UploadZone
          kind="document"
          accept=".pdf,.doc,.docx,.xls,.xlsx,image/jpeg,image/png"
          prompt="Drag and drop your files here"
          hint="PDF, DOCX, XLSX, PNG, JPG (Max 50MB per file)"
          multiple
          onFilesChange={setPendingFiles}
        />
      </Modal>

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Dosyayı Sil"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Vazgeç</Button>
            <Button variant="primary" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Siliniyor…' : 'Sil'}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget?.name}</strong> kalıcı olarak
          silinecek — hem kasadan hem depolamadan. Bu işlem geri alınamaz.
        </p>
      </Modal>
    </div>
  );
};
