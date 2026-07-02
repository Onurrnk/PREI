import React, { useState } from 'react';
import type { VaultDocumentDTO } from '../../core/types';
import { documentsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { Folder, FileText, Image as ImageIcon, FileXls, CloudArrowUp, MagnifyingGlass, DotsThreeVertical, DownloadSimple, ShareNetwork, FolderOpen } from '@phosphor-icons/react';
import styles from './DocumentVault.module.css';

const FOLDERS = ['Root', 'Client KYC', 'Contracts', 'Marketing', 'Developer Agreements'];

export interface DocumentVaultProps {
  clientId?: string;
}

export const DocumentVault: React.FC<DocumentVaultProps> = ({ clientId }) => {
  const { data, loading } = useFetch<VaultDocumentDTO[]>(() => documentsApi.list(), [clientId]);
  const documents = clientId
    ? (data ?? []).filter(d => d.relatedId === clientId || d.folder === 'Client KYC')
    : (data ?? []);
  const [currentFolder, setCurrentFolder] = useState<string>('Root');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
    setShowUploadModal(true);
  };

  const handleSimulateUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setShowUploadModal(false);
      toast.success(`Dosyalar ${currentFolder} klasörüne yüklendi`);
    }, 1500);
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
                <span>45GB / 100GB</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: '45%' }}></div>
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
                    <button className={styles.actionBtn} title="Download"><DownloadSimple size={14} /></button>
                    <button className={styles.actionBtn} title="Share Link"><ShareNetwork size={14} /></button>
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
            <Button variant="outline" onClick={() => setShowUploadModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSimulateUpload} disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload Files'}
            </Button>
          </>
        }
      >
        <div style={{ padding: '40px', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', textAlign: 'center', backgroundColor: 'var(--bg-surface)' }}>
          <CloudArrowUp size={48} color="var(--color-primary-blue)" style={{ marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Drag and drop your files here</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Supports PDF, DOCX, XLSX, PNG, JPG (Max 50MB)</p>
          <Button variant="outline">Browse Files</Button>
        </div>
      </Modal>
    </div>
  );
};
