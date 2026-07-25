// =====================================================================
// PREI | DocumentVault — firma bazlı doküman kasası.
//
// Yapı: Firma → Proje → Kategori. Her firmanın kendi kasası var; evrak
// hangi firmanın hangi projesine ait, tek bakışta belli. Projeye bağlı
// olmayan firma evrakı "Genel" altında toplanır.
//
// clientId verilirse (müşteri kartı içinde) kasa o müşteriye daralır —
// orada firma ağacı gösterilmez, düz liste yeterli.
// =====================================================================
import React, { useMemo, useState } from 'react';
import type {
  VaultDocumentDTO, VaultCompanyNodeDTO, VaultCategory, DeveloperDTO,
} from '../../core/types';
import { documentsApi, developersApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { Field, Select } from '../../core/components/Form/Form';
import { UploadZone } from '../../core/components/Form/UploadZone';
import {
  Buildings, FileText, Image as ImageIcon, FileXls, CloudArrowUp,
  MagnifyingGlass, DownloadSimple, Trash, FolderOpen, CaretRight,
} from '@phosphor-icons/react';
import styles from './DocumentVault.module.css';
import { useTranslation } from 'react-i18next';

/** Backend vault-taxonomy.ts ile birebir — kod ve etiket orada da var. */
const CATEGORIES: { code: VaultCategory; label: string }[] = [
  { code: 'contract',  label: 'Sözleşme' },
  { code: 'permit',    label: 'Ruhsat & İzin' },
  { code: 'legal',     label: 'Tapu & Hukuk' },
  { code: 'technical', label: 'Teknik & Plan' },
  { code: 'marketing', label: 'Broşür & Görsel' },
  { code: 'financial', label: 'Finansal' },
  { code: 'kyc',       label: 'KYC & Kimlik' },
  { code: 'other',     label: 'Diğer' },
];

const GENERAL_BUCKET = '__general__';
const UNASSIGNED_BUCKET = '__unassigned__';

const catLabel = (code: string): string =>
  CATEGORIES.find((c) => c.code === code)?.label ?? 'Diğer';

export interface DocumentVaultProps {
  clientId?: string;
}

export const DocumentVault: React.FC<DocumentVaultProps> = ({ clientId }) => {
  const { t } = useTranslation();
  const toast = useToast();

  const { data, loading, refetch } = useFetch<VaultDocumentDTO[]>(
    () => documentsApi.list(), [clientId]);
  const { data: tree, refetch: refetchTree } = useFetch<VaultCompanyNodeDTO[]>(
    () => documentsApi.tree(), [clientId]);
  const { data: developers } = useFetch<DeveloperDTO[]>(() => developersApi.list(), []);

  const documents = useMemo(() => (
    clientId
      ? (data ?? []).filter((d) => d.relatedId === clientId || d.folder === 'kyc')
      : (data ?? [])
  ), [data, clientId]);

  const companies = tree ?? [];
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState<VaultCategory>('other');
  const [uploadCompany, setUploadCompany] = useState('');
  const [uploadProject, setUploadProject] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<VaultDocumentDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const company = companies.find((c) => c.id === companyId) ?? null;
  const project = company?.projects.find((p) => p.id === projectId) ?? null;

  // Yükleme formundaki firma seçimine göre proje listesi.
  const uploadProjects = useMemo(
    () => (developers ?? []).find((d) => d.id === uploadCompany)?.projects ?? [],
    [developers, uploadCompany],
  );

  if (loading) return <TableSkeleton rows={6} />;

  const visible = documents.filter((doc) => {
    if (companyId) {
      const docCompany = doc.organizationId ?? UNASSIGNED_BUCKET;
      if (docCompany !== companyId) return false;
    }
    if (projectId) {
      const docProject = doc.projectId ?? GENERAL_BUCKET;
      if (docProject !== projectId) return false;
    }
    if (category && doc.folder !== category) return false;
    if (searchQuery && !doc.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText size={32} className={styles.iconPdf} />;
      case 'image': return <ImageIcon size={32} className={styles.iconImage} />;
      case 'excel': return <FileXls size={32} className={styles.iconExcel} />;
      case 'word': return <FileText size={32} className={styles.iconWord} />;
      default: return <FileText size={32} className={styles.iconDefault} />;
    }
  };

  const openUpload = () => {
    setPendingFiles([]);
    // Açık bulunduğun yeri ön-doldur — evrak yanlış firmaya düşmesin.
    setUploadCategory((category as VaultCategory) ?? 'other');
    setUploadCompany(companyId && companyId !== UNASSIGNED_BUCKET ? companyId : '');
    setUploadProject(projectId && projectId !== GENERAL_BUCKET ? projectId : '');
    setShowUploadModal(true);
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) {
      toast.error(t('documents.selectFileFirst'));
      return;
    }
    setIsUploading(true);
    try {
      for (const file of pendingFiles) {
        await documentsApi.upload(file, uploadCategory, {
          organizationId: uploadCompany || undefined,
          projectId: uploadProject || undefined,
        });
      }
      toast.success(t('documents.uploadedToast', {
        count: pendingFiles.length, folder: catLabel(uploadCategory),
      }));
      setShowUploadModal(false);
      setPendingFiles([]);
      refetch();
      refetchTree();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('documents.uploadFailedGeneric'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (doc: VaultDocumentDTO) => {
    try {
      const { url } = await documentsApi.downloadUrl(doc.id);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('documents.downloadLinkFailed'));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await documentsApi.remove(deleteTarget.id);
      toast.success(t('documents.deletedToast'));
      setDeleteTarget(null);
      refetch();
      refetchTree();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('documents.deleteFailedGeneric'));
    } finally {
      setIsDeleting(false);
    }
  };

  const selectCompany = (id: string | null) => {
    setCompanyId(id);
    setProjectId(null);
    setCategory(null);
  };

  const totalMB = documents.reduce((s, d) => s + d.sizeMB, 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('documents.title')}</h1>
          <p className={styles.subtitle}>Her firmanın kendi kasası — firma, proje ve kategoriye göre ayrılmış</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchBar}>
            <MagnifyingGlass size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder={t('documents.searchPlaceholder')}
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="primary" onClick={openUpload}>
            <CloudArrowUp size={16} style={{ marginRight: 8 }} />
            {t('documents.upload')}
          </Button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Firma → Proje gezinmesi */}
        <div className={styles.sidebar}>
          <Card className={styles.foldersCard}>
            <CardHeader><h3 className={styles.cardTitle}>Firmalar</h3></CardHeader>
            <CardBody className={styles.folderList}>
              <div
                className={`${styles.folderItem} ${companyId === null ? styles.activeFolder : ''}`}
                onClick={() => selectCompany(null)}
              >
                <FolderOpen size={18} />
                <span>Tüm firmalar</span>
                <span className={styles.folderCount}>{documents.length}</span>
              </div>

              {companies.map((c) => (
                <div key={c.id}>
                  <div
                    className={`${styles.folderItem} ${companyId === c.id ? styles.activeFolder : ''}`}
                    onClick={() => selectCompany(c.id)}
                  >
                    <Buildings size={18} />
                    <span>{c.name}</span>
                    <span className={styles.folderCount}>{c.count}</span>
                  </div>

                  {/* Firma açıkken projeleri alt seviye olarak göster */}
                  {companyId === c.id && c.projects.map((p) => (
                    <div
                      key={p.id}
                      className={`${styles.projectItem} ${projectId === p.id ? styles.activeProject : ''}`}
                      onClick={() => { setProjectId(projectId === p.id ? null : p.id); setCategory(null); }}
                    >
                      <CaretRight size={12} />
                      <span>{p.name}</span>
                      <span className={styles.folderCount}>{p.count}</span>
                    </div>
                  ))}
                </div>
              ))}

              {companies.length === 0 && (
                <p className={styles.sidebarEmpty}>Henüz evrak yok.</p>
              )}
            </CardBody>
          </Card>

          <Card className={styles.storageCard}>
            <CardBody>
              <div className={styles.storageHeader}>
                <strong>{t('documents.storageUsed')}</strong>
                <span>
                  {totalMB >= 1024 ? `${(totalMB / 1024).toFixed(1)} GB` : `${totalMB.toFixed(1)} MB`}
                  {' · '}{t('documents.fileCount', { count: documents.length })}
                </span>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Dosyalar */}
        <div className={styles.mainArea}>
          <div className={styles.mainAreaHeader}>
            <div>
              <h2 className={styles.currentFolderName}>
                {company ? company.name : 'Tüm firmalar'}
                {project && <span className={styles.crumb}> · {project.name}</span>}
                {category && <span className={styles.crumb}> · {catLabel(category)}</span>}
              </h2>
            </div>
            <span className={styles.fileCountText}>
              {t('documents.fileCount', { count: visible.length })}
            </span>
          </div>

          {/* Kategori süzgeci — seçili firma/projedeki kategoriler */}
          {(project ?? company) && (
            <div className={styles.categoryRow}>
              <button
                type="button"
                className={category === null ? styles.chipActive : styles.chip}
                onClick={() => setCategory(null)}
              >
                Tümü
              </button>
              {(project
                ? project.categories
                : (company?.projects.flatMap((p) => p.categories) ?? [])
              ).reduce<{ code: string; label: string; count: number }[]>((acc, c) => {
                // Firma seviyesinde aynı kategori birden çok projeden gelir → topla.
                const found = acc.find((x) => x.code === c.code);
                if (found) found.count += c.count;
                else acc.push({ ...c });
                return acc;
              }, []).map((c) => (
                <button
                  key={c.code}
                  type="button"
                  className={category === c.code ? styles.chipActive : styles.chip}
                  onClick={() => setCategory(category === c.code ? null : c.code)}
                >
                  {c.label} <span className={styles.chipCount}>{c.count}</span>
                </button>
              ))}
            </div>
          )}

          {visible.length === 0 ? (
            <div className={styles.emptyState}>
              <FolderOpen size={48} className={styles.emptyIcon} />
              <p>{t('documents.emptyFolder')}</p>
              <Button variant="outline" onClick={openUpload}>{t('documents.uploadFirst')}</Button>
            </div>
          ) : (
            <div className={styles.fileGrid}>
              {visible.map((doc) => (
                <div key={doc.id} className={styles.fileCard}>
                  <div className={styles.fileCardHeader}>
                    {getFileIcon(doc.type)}
                    <span className={styles.categoryTag}>{catLabel(doc.folder)}</span>
                  </div>
                  <div className={styles.fileCardBody}>
                    <h4 className={styles.fileName} title={doc.name}>{doc.name}</h4>
                    {/* Tüm firmalar görünümünde nerede olduğu belli olsun */}
                    {!companyId && (
                      <p className={styles.filePath}>
                        {doc.organizationName ?? 'Firma atanmamış'}
                        {doc.projectName ? ` · ${doc.projectName}` : ''}
                      </p>
                    )}
                    <p className={styles.fileMeta}>{doc.sizeMB} MB • {doc.uploadedAt}</p>
                  </div>
                  <div className={styles.fileCardFooter}>
                    <button
                      className={styles.actionBtn}
                      title={t('documents.download')}
                      onClick={() => handleDownload(doc)}
                    >
                      <DownloadSimple size={14} />
                    </button>
                    <button
                      className={styles.actionBtn}
                      title={t('common.delete')}
                      onClick={() => setDeleteTarget(doc)}
                    >
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
        title="Kasaya evrak yükle"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowUploadModal(false)} disabled={isUploading}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary" onClick={handleUpload}
              disabled={isUploading || pendingFiles.length === 0}
            >
              {isUploading ? t('documents.uploading') : t('documents.uploadN', { count: pendingFiles.length })}
            </Button>
          </>
        }
      >
        <Field label="Firma">
          <Select
            value={uploadCompany}
            onChange={(e) => { setUploadCompany(e.target.value); setUploadProject(''); }}
          >
            <option value="">Firma seçilmedi</option>
            {(developers ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Proje">
          <Select
            value={uploadProject}
            onChange={(e) => setUploadProject(e.target.value)}
            disabled={!uploadCompany}
          >
            <option value="">Genel (projeye bağlı değil)</option>
            {uploadProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Kategori">
          <Select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value as VaultCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </Select>
        </Field>

        <UploadZone
          kind="document"
          accept=".pdf,.doc,.docx,.xls,.xlsx,image/jpeg,image/png"
          prompt={t('documents.dropPrompt')}
          hint={t('documents.dropHint')}
          multiple
          onFilesChange={setPendingFiles}
        />
      </Modal>

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('documents.deleteTitle')}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? t('documents.deleting') : t('common.delete')}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget?.name}</strong>{' '}
          {t('documents.deleteBody')}
        </p>
      </Modal>
    </div>
  );
};
