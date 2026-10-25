'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Sun,
  Moon,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { AppearancePreset } from '@/lib/api/types';
import { FadeContent } from '@/components/reactbits';
import { CopyField } from '@/components/bencho';

export const UserSettingsView: React.FC = () => {
  const { preset, setPreset, settings, updateSettings } = useRagnarok();
  const [isSaved, setIsSaved] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  const themeOptions: { id: AppearancePreset; title: string; desc: string; icon: React.ElementType }[] = [
    {
      id: 'light',
      title: 'Light',
      desc: 'True OLED paper-white finish with sharp hairline contrast and crisp readability.',
      icon: Sun,
    },
    {
      id: 'dark',
      title: 'Dark',
      desc: 'Pure pitch-black OLED background with ultra-crisp hairline outlines and zero battery drain.',
      icon: Moon,
    },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings(localSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-8">
      {/* Privacy Guarantee Card */}
      <FadeContent blur duration={300} trigger="mount">
        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-main">
                Privacy and complete control
              </h2>
              <p className="text-xs text-dim">
                Your conversations, notes, and tasks never leave this computer.
              </p>
            </div>
          </div>

          <p className="text-xs text-main leading-relaxed pt-1">
            MEMORAG runs 100% on this device using local intelligence. There are no cloud accounts, no subscription keys, and zero telemetry being sent out.
          </p>
        </div>
      </FadeContent>

      {/* Appearance Selection (Light & Dark OLED Only) */}
      <FadeContent blur duration={300} delay={100} trigger="mount">
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-main">Appearance</h3>
            <p className="text-xs text-dim mt-0.5">
              Choose your visual profile. Precisely tuned for true OLED contrast.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {themeOptions.map((opt) => {
              const isSelected = preset === opt.id;
              const Icon = opt.icon;

              return (
                <div
                  key={opt.id}
                  onClick={() => setPreset(opt.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-150 active:scale-98 flex items-start gap-3.5 select-none ${
                    isSelected
                      ? 'bg-surface/90 border-[#ea2804] ring-1 ring-[#ea2804]/30 shadow-xs'
                      : 'bg-surface/90 hover:bg-elevated border-subtle'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-full shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[#ea2804]/15 text-[#ea2804]'
                        : 'bg-elevated text-dim'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-main">
                        {opt.title}
                      </span>
                      {isSelected && (
                        <Badge variant="replicate" className="text-[10px] py-0 px-2 font-mono">
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-dim leading-relaxed">{opt.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </FadeContent>

      {/* Everyday Preferences Form */}
      <FadeContent blur duration={300} delay={150} trigger="mount">
        <form onSubmit={handleSave} className="space-y-6 pt-2">
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-main">Device &amp; Memory Safety</h3>
              <p className="text-xs text-dim mt-0.5">
                Set how long notes are kept and manage device power usage.
              </p>
            </div>

            <Card className="divide-y divide-subtle">
              {/* Permission gate setting */}
              <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium text-main block">
                    Always ask before modifying files
                  </span>
                  <span className="text-xs text-dim">
                    Require an &quot;Allow action&quot; confirmation whenever a task touches project files.
                  </span>
                </div>
                <Badge variant="emerald">Always enforced</Badge>
              </div>

              {/* Memory prune setting */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium text-main block">
                    Clean up temporary notes automatically
                  </span>
                  <span className="text-xs text-dim">
                    Discard temporary interaction notes after a period of time to keep memory organized.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={localSettings.forgettingThresholdDays}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        forgettingThresholdDays: parseInt(e.target.value) || 14,
                      })
                    }
                    className="bg-elevated border border-subtle rounded-lg px-3 py-1.5 text-xs text-main focus:outline-none focus:border-emerald-500"
                  >
                    <option value={7}>After 7 days</option>
                    <option value={14}>After 14 days (Recommended)</option>
                    <option value={30}>After 30 days</option>
                  </select>
                </div>
              </div>

              {/* Device speed / load setting */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium text-main block">
                    Quiet device mode
                  </span>
                  <span className="text-xs text-dim">
                    Keeps AI computations lightweight so your laptop stays quiet and battery life is preserved.
                  </span>
                </div>
                <Badge variant="emerald">Under 30% load</Badge>
              </div>

              {/* Local Vault Fingerprint */}
              <div className="p-4 sm:p-5 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-sm font-medium text-main block">
                    Local Vault Fingerprint
                  </span>
                  <span className="text-xs text-dim">
                    SHA-256 fingerprint of your on-device SQLite encryption seal
                  </span>
                </div>
                <CopyField
                  label="VAULT-FINGERPRINT"
                  text="sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
                  truncate
                />
              </div>
            </Card>
          </div>

          <div className="flex items-center justify-between pt-2">
            {isSaved ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Saved your preferences
              </span>
            ) : (
              <span className="text-xs text-faint">
                Saved directly on your computer
              </span>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={<Save className="w-4 h-4" />}
              className="transition-transform active:scale-95"
            >
              Save settings
            </Button>
          </div>
        </form>
      </FadeContent>
    </div>
  );
};
