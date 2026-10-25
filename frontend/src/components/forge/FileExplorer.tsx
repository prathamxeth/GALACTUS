'use client';

import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileJson,
  FileSpreadsheet,
  File,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Search,
  GitBranch,
} from 'lucide-react';
import { FileEntry } from '@/lib/forge/types';
import { useForge } from '@/lib/forge/ForgeContext';

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    case 'js':
    case 'jsx':
    case 'mjs':
      return <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    case 'py':
      return <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    case 'json':
      return <FileJson className="w-3.5 h-3.5 text-yellow-500 shrink-0" />;
    case 'css':
      return <FileSpreadsheet className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
    case 'md':
      return <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    default:
      return <File className="w-3.5 h-3.5 text-muted shrink-0" />;
  }
}

interface TreeItemProps {
  entry: FileEntry;
  depth: number;
  onSelect: (path: string) => void;
  selectedPath: string | null;
}

const TreeItem: React.FC<TreeItemProps> = ({ entry, depth, onSelect, selectedPath }) => {
  const [isOpen, setIsOpen] = useState(depth === 0);
  const isSelected = selectedPath === entry.path;

  if (entry.type === 'directory') {
    return (
      <div className="select-none">
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className="flex items-center gap-1.5 py-1 pr-2 text-xs text-secondary hover:text-main hover:bg-elevated/60 cursor-pointer rounded transition-colors group"
        >
          {isOpen ? (
            <ChevronDown className="w-3 h-3 text-muted" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted" />
          )}
          {isOpen ? (
            <FolderOpen className="w-3.5 h-3.5 text-[#cc785c] shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-[#cc785c] shrink-0" />
          )}
          <span className="truncate font-mono text-[11px]">{entry.name}</span>
        </div>
        {isOpen && entry.children && (
          <div>
            {entry.children.map((child) => (
              <TreeItem
                key={child.path}
                entry={child}
                depth={depth + 1}
                onSelect={onSelect}
                selectedPath={selectedPath}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelect(entry.path)}
      style={{ paddingLeft: `${depth * 12 + 18}px` }}
      className={`flex items-center justify-between py-1 pr-2 text-xs cursor-pointer rounded transition-colors group ${
        isSelected
          ? 'bg-[#F04424]/10 text-main font-medium border-l-2 border-[#F04424]'
          : 'text-secondary hover:text-main hover:bg-elevated/60'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {getFileIcon(entry.name)}
        <span className="truncate font-mono text-[11px]">{entry.name}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-1">
        {entry.isGitModified && (
          <span className="text-[9px] font-mono font-bold text-amber-500 px-1 rounded bg-amber-500/10" title="Modified in git">
            M
          </span>
        )}
        {entry.isGitUntracked && (
          <span className="text-[9px] font-mono font-bold text-emerald-500 px-1 rounded bg-emerald-500/10" title="Untracked in git">
            U
          </span>
        )}
      </div>
    </div>
  );
};

export const FileExplorer: React.FC = () => {
  const { fileTree, isLoadingTree, refreshFileTree, openFile, activeFile, preflightReport } = useForge();
  const [filterQuery, setFilterQuery] = useState('');

  // Flattened filtered search
  const filteredFiles = useMemo(() => {
    if (!filterQuery.trim()) return null;
    const q = filterQuery.toLowerCase();
    const result: FileEntry[] = [];

    function search(entries: FileEntry[]) {
      for (const e of entries) {
        if (e.type === 'file' && e.name.toLowerCase().includes(q)) {
          result.push(e);
        }
        if (e.children) search(e.children);
      }
    }
    search(fileTree);
    return result;
  }, [fileTree, filterQuery]);

  return (
    <div className="flex flex-col h-full bg-surface select-none">
      {/* Explorer Header */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-subtle shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => refreshFileTree()}
            className="p-1 rounded text-muted hover:text-main hover:bg-elevated transition-colors"
            title="Refresh file tree"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingTree ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Search */}
      <div className="p-2 border-b border-subtle shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-canvas border border-subtle text-xs">
          <Search className="w-3 h-3 text-muted shrink-0" />
          <input
            type="text"
            placeholder="Filter files..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-main placeholder:text-muted focus:outline-hidden font-mono"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="text-[10px] text-muted hover:text-main"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* File Tree / Search Results */}
      <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
        {filteredFiles !== null ? (
          <div className="space-y-0.5">
            <div className="text-[10px] uppercase font-mono text-muted px-2 py-1">
              Matching files ({filteredFiles.length})
            </div>
            {filteredFiles.length === 0 ? (
              <div className="text-xs text-muted px-3 py-4 text-center">
                No files match &quot;{filterQuery}&quot;
              </div>
            ) : (
              filteredFiles.map((f) => (
                <div
                  key={f.path}
                  onClick={() => openFile(f.path)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer hover:bg-elevated ${
                    activeFile?.path === f.path ? 'bg-[#ea2804]/10 text-main' : 'text-secondary'
                  }`}
                >
                  {getFileIcon(f.name)}
                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-mono text-[11px]">{f.name}</span>
                    <span className="text-[9px] text-muted truncate">{f.path}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : fileTree.length === 0 ? (
          <div className="text-xs text-muted p-4 text-center">
            {isLoadingTree ? 'Scanning workspace...' : 'No files detected in project.'}
          </div>
        ) : (
          fileTree.map((entry) => (
            <TreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              onSelect={openFile}
              selectedPath={activeFile?.path || null}
            />
          ))
        )}
      </div>

      {/* Git Status Footer */}
      {preflightReport?.git && (
        <div className="p-2 border-t border-subtle bg-canvas/40 shrink-0 text-[11px]">
          <div className="flex items-center justify-between text-muted font-mono">
            <span className="flex items-center gap-1 text-secondary">
              <GitBranch className="w-3 h-3 text-[#cc785c]" />
              {preflightReport.git.branch}
            </span>
            <span>
              {preflightReport.git.modifiedCount === 0 ? (
                <span className="text-emerald-500 text-[10px]">clean</span>
              ) : (
                <span className="text-amber-500 text-[10px]">
                  {preflightReport.git.modifiedCount} changed
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
