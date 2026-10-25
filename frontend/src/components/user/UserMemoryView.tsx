'use client';

import React, { useState } from 'react';
import {
  Brain,
  Search,
  Download,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  X,
  Sparkles,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { MemoryRecord } from '@/lib/api/types';
import { FadeContent, CountUp, StarBorder } from '@/components/reactbits';

export const UserMemoryView: React.FC = () => {
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

  const [activeTab, setActiveTab] = useState<'all' | 'semantic' | 'episodic'>('all');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'about' | 'preferences' | 'projects'>('all');

  // Deletion Confirmation Dialog State
  const [itemToDelete, setItemToDelete] = useState<MemoryRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // New Fact Creation Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<'preference' | 'fact' | 'entity' | 'rule'>('preference');
  const [newKey, setNewKey] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newIsVerified, setNewIsVerified] = useState(true);
  const [isSubmittingFact, setIsSubmittingFact] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Export State
  const [isExporting, setIsExporting] = useState(false);

  // Category categorization mapping
  const getCategory = (mem: MemoryRecord): 'about' | 'preferences' | 'projects' => {
    if (mem.type === 'semantic') {
      if (mem.category === 'preference') return 'preferences';
      if (mem.category === 'rule' || mem.category === 'entity') return 'about';
      return 'projects';
    }
    return 'projects';
  };

  const getHumanStatement = (mem: MemoryRecord): string => {
    if (mem.type === 'semantic') return mem.statement;
    return mem.content;
  };

  const getUtilityReason = (mem: MemoryRecord): string => {
    if (mem.type === 'semantic') {
      if (mem.category === 'preference') return 'Helps me tailor recommendations to your taste.';
      if (mem.category === 'rule') return 'Ensures I never violate your privacy or device safety guidelines.';
      return 'Keeps project requirements in mind so you don’t have to re-explain context.';
    }
    return 'Record from our past task execution or conversation.';
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await deleteMemory(itemToDelete.id);
      if (res.success) {
        setItemToDelete(null);
      } else {
        setDeleteError(res.error || 'Failed to delete memory item from backend.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newContent.trim()) return;

    setIsSubmittingFact(true);
    setCreateError(null);

    const res = await createSemanticFact({
      category: newCategory,
      fact_key: newKey.trim(),
      fact_content: newContent.trim(),
      is_verified: newIsVerified,
      tokens: Math.max(1, Math.ceil(newContent.trim().length / 4)),
    });

    setIsSubmittingFact(false);
    if (res.success) {
      setIsCreateOpen(false);
      setNewKey('');
      setNewContent('');
      setNewCategory('preference');
    } else {
      setCreateError(res.error || 'Backend rejected the new fact.');
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
    if (activeTab === 'semantic' && mem.type !== 'semantic') return false;
    if (activeTab === 'episodic' && mem.type !== 'episodic') return false;

    const cat = getCategory(mem);
    if (selectedCategory !== 'all' && cat !== selectedCategory) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const text = getHumanStatement(mem).toLowerCase();
      const key = (mem.type === 'semantic' ? mem.subject : mem.title).toLowerCase();
      return text.includes(q) || key.includes(q);
    }
    return true;
  });

  const semanticCount = memories.filter((m) => m.type === 'semantic').length;
  const episodicCount = memories.filter((m) => m.type === 'episodic').length;

  return (
    <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Header with StarBorder primary action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-main">
            Things I remember
          </h2>
          <p className="text-xs text-dim mt-0.5">
            Facts, preferences, and events remembered safely on this device.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            loading={isExporting}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Export memories
          </Button>

          <StarBorder
            as="button"
            onClick={() => {
              setCreateError(null);
              setIsCreateOpen(true);
            }}
            color="#ea2804"
            trailColor="rgba(234, 40, 4, 0.3)"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full text-white bg-[#ea2804] hover:bg-[#c01f00] cursor-pointer shadow-xs active:scale-98 transition-transform font-mono"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Teach me something</span>
          </StarBorder>
        </div>
      </div>

      {/* Backend Status / Offline Notice */}
      {!isBackendOnline && (
        <div className="p-3.5 rounded-xl bg-surface border border-subtle flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-dim">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Memory service currently running in local offline mode. Stored memories remain securely on your device.
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => loadMemories(search)}
            icon={<RefreshCw className="w-3 h-3" />}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Error Banner with Retry */}
      {memoryError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{memoryError}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadMemories(search)}
            icon={<RefreshCw className="w-3 h-3" />}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Main Filter & Search Bar with Replicate Pill Groups */}
      <div className="space-y-3">
        {/* Memory Type Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-elevated/90 p-1 rounded-full border border-subtle text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1 rounded-full cursor-pointer transition-all ${
                activeTab === 'all'
                  ? 'bg-[#ea2804] text-white font-semibold shadow-xs'
                  : 'text-dim hover:text-main'
              }`}
            >
              All items (<CountUp to={memories.length} duration={0.4} />)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('semantic')}
              className={`px-3.5 py-1 rounded-full cursor-pointer transition-all ${
                activeTab === 'semantic'
                  ? 'bg-[#ea2804] text-white font-semibold shadow-xs'
                  : 'text-dim hover:text-main'
              }`}
            >
              Facts &amp; Preferences (<CountUp to={semanticCount} duration={0.4} />)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('episodic')}
              className={`px-3.5 py-1 rounded-full cursor-pointer transition-all ${
                activeTab === 'episodic'
                  ? 'bg-[#ea2804] text-white font-semibold shadow-xs'
                  : 'text-dim hover:text-main'
              }`}
            >
              Past Events (<CountUp to={episodicCount} duration={0.4} />)
            </button>
          </div>

          {/* Search Input with Clear Button (Replicate Pill) */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-faint absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search what I remember..."
              className="w-full text-xs font-mono bg-surface/90 border border-subtle rounded-full pl-9 pr-8 py-2 text-main placeholder-faint focus:outline-none focus:border-[#ea2804] transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-faint hover:text-main cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Human Categories Sub-tabs (Replicate Pill Tags) */}
        {activeTab !== 'episodic' && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-dim">
            <span className="text-[11px] font-mono text-faint mr-1">Category:</span>
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'about', label: 'About me' },
                { id: 'preferences', label: 'My preferences' },
                { id: 'projects', label: 'Things we’re working on' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-full cursor-pointer text-xs font-mono transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-elevated text-main font-semibold border border-medium shadow-xs'
                    : 'text-dim hover:text-main'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Memory Cards Stream with React Bits FadeContent */}
      {isLoadingMemories ? (
        <div className="p-12 text-center rounded-xl bg-surface border border-subtle text-dim space-y-2">
          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-emerald-500" />
          <p className="text-xs">Loading remembered facts...</p>
        </div>
      ) : filtered.length === 0 ? (
        <FadeContent blur duration={300} trigger="mount">
          <div className="p-12 text-center rounded-xl bg-surface border border-subtle text-dim space-y-3">
            <Brain className="w-8 h-8 mx-auto text-faint" />
            <p className="text-sm">
              {search ? 'No matching memories found for your search.' : 'Nothing remembered here yet.'}
            </p>
            {search ? (
              <Button size="sm" variant="ghost" onClick={() => setSearch('')}>
                Clear search filter
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCreateOpen(true)}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Add a preference or fact
              </Button>
            )}
          </div>
        </FadeContent>
      ) : (
        <div className="space-y-3">
          {filtered.map((mem) => {
            const isSem = mem.type === 'semantic';
            const statement = getHumanStatement(mem);
            const utility = getUtilityReason(mem);
            const isVerified = isSem ? mem.isVerified ?? true : true;

            return (
              <FadeContent key={mem.id} blur duration={250} trigger="mount">
                <Card className="p-4 hover:border-medium transition-colors space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-faint">
                          #{mem.id}
                        </span>

                        {/* Verified Badge */}
                        {isSem && (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              isVerified
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {isVerified ? (
                              <>
                                <CheckCircle2 className="w-2.5 h-2.5" /> Verified fact
                              </>
                            ) : (
                              <>
                                <HelpCircle className="w-2.5 h-2.5" /> Unconfirmed
                              </>
                            )}
                          </span>
                        )}

                        <Badge variant={mem.type === 'semantic' ? 'purple' : 'sky'}>
                          {mem.type === 'semantic' ? mem.category : 'Past event'}
                        </Badge>
                      </div>

                      <h4 className="text-sm font-semibold text-main">
                        {mem.type === 'semantic' ? mem.subject : mem.title}
                      </h4>

                      <p className="text-xs text-main leading-relaxed">
                        &quot;{statement}&quot;
                      </p>
                    </div>

                    {/* Actions: Forget button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setItemToDelete(mem)}
                      icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                      title="Forget this"
                      className="hover:bg-rose-500/10 hover:text-rose-600 text-dim transition-colors"
                    >
                      Forget
                    </Button>
                  </div>

                  {/* Plain language explanation of why this memory is useful */}
                  <div className="pt-2 border-t border-subtle flex flex-wrap items-center justify-between gap-2 text-[11px] text-dim">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span>Why I remember this: {utility}</span>
                    </span>

                    <span className="text-faint text-[10px]" suppressHydrationWarning>
                      {new Date(
                        mem.type === 'episodic' ? mem.timestamp : mem.updatedAt
                      ).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </Card>
              </FadeContent>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog (Real DELETE /api/memory/{id}) */}
      <Modal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        title="Forget this memory?"
        description="This will permanently delete this information from this device."
      >
        {itemToDelete && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-surface border border-subtle space-y-1.5 text-xs">
              <span className="text-faint block text-[11px] font-mono">
                Memory Identifier: #{itemToDelete.id}
              </span>
              <p className="text-main font-medium">
                &quot;{getHumanStatement(itemToDelete)}&quot;
              </p>
              <p className="text-dim text-[11px]">
                Once forgotten, the agent will no longer use this fact or context during reasoning.
              </p>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs">
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
                Keep memory
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                loading={isDeleting}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Confirm &amp; Forget
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Semantic Fact Modal (POST /api/memory/semantic) */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Teach me something"
        description="Store a verified preference or rule for future assistance (POST /api/memory/semantic)"
      >
        <form onSubmit={handleCreateFact} className="space-y-4 text-xs">
          <div>
            <label className="text-main font-medium block mb-1">
              Category:
            </label>
            <select
              value={newCategory}
              onChange={(e) =>
                setNewCategory(e.target.value as 'preference' | 'fact' | 'entity' | 'rule')
              }
              className="w-full rounded-lg bg-surface border border-subtle p-2 text-main focus:outline-none focus:border-emerald-500"
            >
              <option value="preference">My preference</option>
              <option value="fact">Personal fact / project detail</option>
              <option value="rule">Guideline / rule</option>
              <option value="entity">Entity name or reference</option>
            </select>
          </div>

          <div>
            <label className="text-main font-medium block mb-1">
              Topic / Key:
            </label>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="e.g. Preferred test runner or coding style"
              required
              className="w-full rounded-lg bg-surface border border-subtle p-2.5 text-main placeholder-faint focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-main font-medium block mb-1">
              Statement / Fact content:
            </label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="e.g. Always write clean TypeScript with zero warnings before deploying."
              rows={3}
              required
              className="w-full rounded-lg bg-surface border border-subtle p-2.5 text-main placeholder-faint focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_verified"
              checked={newIsVerified}
              onChange={(e) => setNewIsVerified(e.target.checked)}
              className="rounded border-subtle text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="is_verified" className="text-main cursor-pointer select-none">
              Mark as verified fact
            </label>
          </div>

          {createError && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs">
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
              loading={isSubmittingFact}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Remember this fact
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
