import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, Funnel, UsersThree, Buildings } from '@phosphor-icons/react';
import { leadsApi, clientsApi, projectsApi } from '../../api/resources';
import type { LeadDTO, ClientDTO, ProjectDTO } from '../../types';
import styles from './GlobalSearch.module.css';

interface Hit {
  kind: 'lead' | 'client' | 'project';
  id: string;
  title: string;
  sub: string;
  to: string;
}

const KIND_ICON = {
  lead: <Funnel size={14} />,
  client: <UsersThree size={14} />,
  project: <Buildings size={14} />,
} as const;

const KIND_LABEL = { lead: 'Leads', client: 'Clients', project: 'Projects' } as const;

/**
 * Ctrl+K global arama — leads/clients/projects üstünde canlı filtre.
 * Veri ilk aramada bir kez çekilir (mevcut list uçları; mock modda MSW).
 */
export const GlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pool, setPool] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Ctrl+K / Cmd+K → odakla
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Dış tık → kapan
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Havuz: ilk aramada bir kez çekilir
  const ensurePool = async () => {
    if (pool || loading) return;
    setLoading(true);
    try {
      const [leads, clients, projects] = await Promise.all([
        leadsApi.list().catch(() => [] as LeadDTO[]),
        clientsApi.list().catch(() => [] as ClientDTO[]),
        projectsApi.list().catch(() => [] as ProjectDTO[]),
      ]);
      const hits: Hit[] = [
        ...leads.map((l): Hit => ({
          kind: 'lead', id: l.id, title: l.contactName,
          sub: [l.company, l.status].filter(Boolean).join(' · '), to: '/leads',
        })),
        ...clients.map((c): Hit => ({
          kind: 'client', id: c.id, title: c.name,
          sub: [c.clientId, c.nationality].filter(Boolean).join(' · '), to: `/clients/${c.id}`,
        })),
        ...projects.map((p): Hit => ({
          kind: 'project', id: p.id, title: p.name,
          sub: [p.developerName, p.location].filter(Boolean).join(' · '), to: `/projects/${p.id}`,
        })),
      ];
      setPool(hits);
    } finally {
      setLoading(false);
    }
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || !pool) return [];
    return pool
      .filter(h => h.title.toLowerCase().includes(q) || h.sub.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, pool]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  const go = (hit: Hit) => {
    setOpen(false);
    setQuery('');
    navigate(hit.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(results.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); }
    if (e.key === 'Enter' && results[activeIdx]) { e.preventDefault(); go(results[activeIdx]); }
  };

  // Grup başlıkları için sıralı render
  let lastKind: Hit['kind'] | null = null;

  return (
    <div className={styles.root} ref={rootRef}>
      <MagnifyingGlass className={styles.icon} size={20} />
      <input
        ref={inputRef}
        type="text"
        placeholder="Global Search (Leads, Clients, Projects...)"
        className={styles.input}
        value={query}
        aria-label="Global search"
        onChange={(e) => { setQuery(e.target.value); setOpen(true); void ensurePool(); }}
        onFocus={() => { if (query.trim().length >= 2) setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      <div className={styles.shortcut}>Ctrl+K</div>

      {open && query.trim().length >= 2 && (
        <div className={styles.dropdown} role="listbox" aria-label="Search results">
          {loading && !pool && <div className={styles.empty}>Searching…</div>}
          {pool && results.length === 0 && (
            <div className={styles.empty}>No results for “{query.trim()}”</div>
          )}
          {results.map((hit, i) => {
            const showHeader = hit.kind !== lastKind;
            lastKind = hit.kind;
            return (
              <React.Fragment key={`${hit.kind}-${hit.id}`}>
                {showHeader && <div className={styles.groupHeader}>{KIND_LABEL[hit.kind]}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activeIdx}
                  className={`${styles.item} ${i === activeIdx ? styles.itemActive : ''}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => go(hit)}
                >
                  <span className={styles.itemIcon}>{KIND_ICON[hit.kind]}</span>
                  <span className={styles.itemTitle}>{hit.title}</span>
                  <span className={styles.itemSub}>{hit.sub}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};
