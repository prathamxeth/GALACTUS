'use client';

import React, { useState } from 'react';
import {
  Database,
  Search,
  Download,
  Trash2,
  Eye,
  Lock,
  Plus,
  RefreshCw,
  AlertCircle,
  X,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import {
  MemoryRecord,
  EpisodicMemory,
  SemanticMemory,
  SemanticCategory,
  CreateSemanticFactRequest,
} from '@/lib/api/types';
import { FadeContent, CountUp, StarBorder } from '@/components/reactbits';
import { CopyField } from '@/components/bencho';

export const DevMemoryInspector: React.FC = () => {
  const {
    memories,
    deleteMemory,
    createSemanticFact,
    exportMemories,
    loadMemories,
    isLoadingMemories,
    memoryError,
    isBackendOnline,
  } = useRagnarok();

  const [activeTab, setActiveTab] = useState<'all' | 'episodic' | 'semantic'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | SemanticCategory>('all');
  const [search, setSearch] = useState('');

  // Inspector Modal
  const [inspectingItem, setInspectingItem] = useState<MemoryRecord | null>(null);

  // Delete Confirmation Dialog
  const [itemToDelete, setItemToDelete] = useState<MemoryRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Create Semantic Fact Modal (POST /api/memory/semantic)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<SemanticCategory>('fact');
  const [newKey, setNewKey] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newVerified, setNewVerified] = useState(true);
  const [isCreatingFact, setIsCreatingFact] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Export State
  const [isExporting, setIsExporting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await deleteMemory(itemToDelete.id);
      if (res.success) {
        setItemToDelete(null);
        if (inspectingItem?.id === itemToDelete.id) setInspectingItem(null);
      } else {
        setDeleteError(res.error || `HTTP error deleting memory #${itemToDelete.id}`);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newContent.trim()) return;

    setIsCreatingFact(true);
    setCreateError(null);

    const payload: CreateSemanticFactRequest = {
      category: newCategory,
      fact_key: newKey.trim(),
      fact_content: newContent.trim(),
      is_verified: newVerified,
      tokens: Math.max(1, Math.ceil(newContent.trim().length / 4)),
    };

    const res = await createSemanticFact(payload);
    setIsCreatingFact(false);

    if (res.success) {
      setNewKey('');
      setNewContent('');
      setIsCreateOpen(false);
    } else {
      setCreateError(res.error || 'Backend failed to write semantic fact.');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportMemories();
    } finally {
      setIsExporting(false);
    }
  };

  const filtered = memories.filter((mem) => {
    if (activeTab !== 'all' && mem.type !== activeTab) return false;
    if (mem.type === 'semantic' && categoryFilter !== 'all' && mem.category !== categoryFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      if (mem.type === 'episodic') {
        return (
          mem.title.toLowerCase().includes(q) ||
          mem.content.toLowerCase().includes(q) ||
          mem.tags.some((t) => t.toLowerCase().includes(q))
        );
      } else {
        return (
          mem.subject.toLowerCase().includes(q) ||
          mem.statement.toLowerCase().includes(q) ||
          (mem.factKey && mem.factKey.toLowerCase().includes(q))
        );
      }
    }
    return true;
  });

  const episodicCount = memories.filter((m) => m.type === 'episodic').length;
  const semanticCount = memories.filter((m) => m.type === 'semantic').length;

  return (
    <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-main flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Memory Inspector (Mimir &amp; Muninn FR1)
          </h2>
          <p className="text-xs text-dim mt-0.5 font-mono">
            Vector embeddings, semantic facts, episodic saga traces, and encrypted storage
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            loading={isExporting}
            icon={<Download className="w-3.5 h-3.5" />}
            className="font-mono text-xs"
          >
            Export Memory Vault
          </Button>

          <StarBorder
            as="button"
            onClick={() => {
              setCreateError(null);
              setIsCreateOpen(true);
            }}
            color="#10b981"
            trailColor="rgba(16, 185, 129, 0.3)"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 cursor-pointer shadow-xs active:scale-98 transition-transform font-mono"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Inscribe Semantic Fact</span>
          </StarBorder>
        </div>
      </div>

      {/* Backend Status / Offline Notice */}
      {!isBackendOnline && (
        <div className="p-3.5 rounded-lg bg-surface border border-subtle flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-dim">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>FastAPI backend offline at port 8000. Inspecting cached local vector runes.</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => loadMemories(search)}
            icon={<RefreshCw className="w-3 h-3" />}
          >
            Retry Connection
          </Button>
        </div>
      )}

      {/* Error Banner with Retry */}
      {memoryError && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs font-mono text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{memoryError}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadMemories(search)}
            icon={<RefreshCw className="w-3 h-3" />}
          >
            Retry Fetch
          </Button>
        </div>
      )}

      {/* Filter Toolbar with CountUp */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-subtle text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded cursor-pointer transition-all ${
              activeTab === 'all'
                ? 'bg-elevated text-main font-semibold border border-subtle'
                : 'text-dim hover:text-main'
            }`}
          >
            All Runes (<CountUp to={memories.length} duration={0.4} />)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('episodic')}
            className={`px-3 py-1 rounded cursor-pointer transition-all ${
              activeTab === 'episodic'
                ? 'bg-elevated text-main font-semibold border border-subtle'
                : 'text-dim hover:text-main'
            }`}
          >
            Episodic Saga (<CountUp to={episodicCount} duration={0.4} />)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('semantic')}
            className={`px-3 py-1 rounded cursor-pointer transition-all ${
              activeTab === 'semantic'
                ? 'bg-elevated text-main font-semibold border border-subtle'
                : 'text-dim hover:text-main'
            }`}
          >
            Mimir Semantic (<CountUp to={semanticCount} duration={0.4} />)
          </button>
        </div>

        {activeTab !== 'episodic' && (
          <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-subtle text-xs font-mono">
            {(['all', 'fact', 'preference', 'rule', 'entity'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-0.5 rounded cursor-pointer capitalize text-[11px] transition-colors ${
                  categoryFilter === cat
                    ? 'bg-elevated text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-dim hover:text-main'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-faint absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search runes, tags, or subject keys..."
            className="w-full text-xs font-mono bg-surface border border-subtle rounded-lg pl-8.5 pr-8 py-1.5 text-main placeholder-faint focus:outline-none focus:border-emerald-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2 text-faint hover:text-main cursor-pointer"
              title="Clear search filter"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Memory Cards Stream with FadeContent */}
      {isLoadingMemories ? (
        <div className="p-12 text-center rounded-xl bg-surface border border-subtle text-dim font-mono space-y-2">
          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-emerald-500" />
          <p className="text-xs">Querying SQLite / SQLCipher vector store...</p>
        </div>
      ) : filtered.length === 0 ? (
        <FadeContent blur duration={300} trigger="mount">
          <div className="p-12 text-center rounded-xl bg-surface border border-subtle text-dim font-mono space-y-3">
            <Database className="w-8 h-8 mx-auto text-faint" />
            <p className="text-xs">
              {search ? 'No memory records match active query filter.' : 'Vault empty. No records returned by backend.'}
            </p>
            {search && (
              <Button size="sm" variant="ghost" onClick={() => setSearch('')}>
                Reset search
              </Button>
            )}
          </div>
        </FadeContent>
      ) : (
        <div className="space-y-3">
          {filtered.map((mem) => {
            const isEpisodic = mem.type === 'episodic';
            const epi = isEpisodic ? (mem as EpisodicMemory) : null;
            const sem = !isEpisodic ? (mem as SemanticMemory) : null;
            const isVerified = sem ? sem.isVerified ?? true : true;

            return (
              <FadeContent key={mem.id} blur duration={250} trigger="mount">
                <Card className="p-4 space-y-2 hover:border-medium transition-colors">
                  <div className="flex items-start justify-between gap-4 font-mono">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        #{mem.id}
                      </span>
                      <Badge
                        variant={isEpisodic ? 'sky' : 'purple'}
                        className="text-[10px] uppercase"
                      >
                        {isEpisodic ? 'Episodic' : sem?.category}
                      </Badge>

                      {sem && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            isVerified
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-zinc-500/10 text-dim border border-subtle'
                          }`}
                        >
                          {isVerified ? 'VERIFIED' : 'UNCONFIRMED'}
                        </span>
                      )}

                      {sem?.tokens !== undefined && (
                        <span className="text-[10px] text-faint font-mono inline-flex items-center gap-1">
                          <CountUp to={sem.tokens} duration={0.3} />
                          <span>tokens</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setInspectingItem(mem)}
                        className="p-1 text-dim hover:text-main cursor-pointer"
                        title="Inspect Vector Rune Metadata"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemToDelete(mem)}
                        className="p-1 text-dim hover:text-rose-500 cursor-pointer"
                        title="Norn's Cut (DELETE /api/memory/{id})"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-main font-mono">
                      {isEpisodic ? epi?.title : sem?.subject}
                    </h4>
                    <p className="text-xs text-dim mt-1 font-mono leading-relaxed bg-surface/50 p-2 rounded border border-subtle">
                      &quot;{isEpisodic ? epi?.content : sem?.statement}&quot;
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-subtle text-[11px] font-mono text-faint">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-emerald-500" />
                      <span>AES-256-GCM / SQLCipher Sealed</span>
                    </span>

                    <span>
                      Timestamp: {new Date(isEpisodic ? epi!.timestamp : sem!.updatedAt).toISOString()}
                    </span>
                  </div>
                </Card>
              </FadeContent>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal (Real DELETE /api/memory/{id}) */}
      <Modal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        title="Confirm Memory Deletion (Norn's Cut)"
        description="Permanently erases vector embedding and database record via DELETE /api/memory/{id}"
      >
        {itemToDelete && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-3 rounded-lg bg-surface border border-subtle space-y-1.5">
              <div className="flex justify-between text-dim">
                <span>Rune Identifier:</span>
                <span className="text-main font-semibold">#{itemToDelete.id}</span>
              </div>
              <div className="flex justify-between text-dim">
                <span>Storage Class:</span>
                <span className="text-emerald-500 uppercase">{itemToDelete.type}</span>
              </div>
              <div className="pt-1 text-main">
                &quot;{itemToDelete.type === 'semantic' ? itemToDelete.statement : itemToDelete.content}&quot;
              </div>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300">
                {deleteError}
              </div>
            )}

            <div className="pt-2 border-t border-subtle flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
              >
                Abort
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                loading={isDeleting}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Confirm Deletion
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Inscribe Semantic Fact Modal (POST /api/memory/semantic) */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Inscribe Semantic Memory (POST /api/memory/semantic)"
        description="Write a structured knowledge record into the local vector database"
      >
        <form onSubmit={handleCreateFact} className="space-y-4 font-mono text-xs">
          <div>
            <label className="text-main font-medium block mb-1">Category Classification:</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as SemanticCategory)}
              className="w-full rounded-lg bg-surface border border-subtle p-2 text-main"
            >
              <option value="fact">fact (Factual knowledge / domain data)</option>
              <option value="preference">preference (User preference / taste)</option>
              <option value="rule">rule (Operational rule / security policy)</option>
              <option value="entity">entity (Entity definition / system handle)</option>
            </select>
          </div>

          <div>
            <label className="text-main font-medium block mb-1">Fact Key (Subject / Identifier):</label>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="e.g. user_default_terminal_shell"
              required
              className="w-full rounded-lg bg-surface border border-subtle p-2.5 text-main focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-main font-medium block mb-1">Fact Content (Statement):</label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="e.g. Standardize on zsh with POSIX compliant scripting."
              rows={3}
              required
              className="w-full rounded-lg bg-surface border border-subtle p-2.5 text-main focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dev_is_verified"
              checked={newVerified}
              onChange={(e) => setNewVerified(e.target.checked)}
              className="rounded border-subtle text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="dev_is_verified" className="text-main cursor-pointer select-none">
              Mark as verified fact (is_verified: true)
            </label>
          </div>

          {createError && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300">
              {createError}
            </div>
          )}

          <div className="pt-2 border-t border-subtle flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isCreatingFact}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Inscribe in Vault
            </Button>
          </div>
        </form>
      </Modal>

      {/* Vector Metadata Inspection Modal with FadeContent */}
      <Modal
        isOpen={Boolean(inspectingItem)}
        onClose={() => setInspectingItem(null)}
        title="Vector Rune Inspection"
        description="Cryptographic metadata and raw storage representation (FR1.2)"
      >
        {inspectingItem && (
          <FadeContent blur duration={200} trigger="mount">
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-surface border border-subtle space-y-1.5">
                <div className="flex justify-between text-dim">
                  <span>Rune Identifier:</span>
                  <span className="text-main font-semibold">{inspectingItem.id}</span>
                </div>
                <div className="flex justify-between text-dim">
                  <span>Storage Class:</span>
                  <span className="text-emerald-500 uppercase">{inspectingItem.type}</span>
                </div>
                <div className="flex justify-between text-dim">
                  <span>Encryption Seal:</span>
                  <span className="text-emerald-500 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    AES-256-GCM / SQLCipher Sealed
                  </span>
                </div>
                <div className="flex justify-between text-dim">
                  <span>Vector Dimension:</span>
                  <span className="text-main">384-dim (nomic-embed-text)</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-faint uppercase block mb-1">
                  Rune Reference Key
                </span>
                <CopyField
                  text={`memorag:rune:${inspectingItem.type}:${inspectingItem.id}`}
                  label="RUNE-REF"
                  truncate={false}
                />
              </div>

              <div>
                <span className="text-[11px] text-faint uppercase block mb-1">
                  Raw JSON Schema
                </span>
                <pre className="p-3 rounded-lg bg-elevated border border-subtle text-emerald-600 dark:text-emerald-300 overflow-x-auto text-[11px]">
                  {JSON.stringify(inspectingItem, null, 2)}
                </pre>
              </div>
            </div>
          </FadeContent>
        )}
      </Modal>
    </div>
  );
};
