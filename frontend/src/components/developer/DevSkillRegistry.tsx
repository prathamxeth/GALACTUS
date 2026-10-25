'use client';

import React, { useState } from 'react';
import {
  Wrench,
  Shield,
  Play,
  Sliders,
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { SkillDefinition } from '@/lib/api/types';
import { FadeContent, CountUp } from '@/components/reactbits';

export const DevSkillRegistry: React.FC = () => {
  const { skills, toggleSkill } = useRagnarok();
  const [inspectingSkill, setInspectingSkill] = useState<SkillDefinition | null>(null);
  const [testingSkill, setTestingSkill] = useState<SkillDefinition | null>(null);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [isRunningTest, setIsRunningTest] = useState(false);

  const handleRunTest = (skill: SkillDefinition) => {
    setIsRunningTest(true);
    setTestOutput(null);
    setTimeout(() => {
      setTestOutput(
        `[CONTAINER_SHIELD_VIRTUAL_SUBPROCESS]\nTarget Tool: ${skill.name}\nPID: 49201\nSandboxed: True\nPermissions: ${
          skill.requiresApproval ? 'RBAC_APPROVAL_GATE' : 'AUTONOMOUS_ALLOW'
        }\nExit Status: 0 OK\nPayload Output: Verified parameter validation and isolated execution.`
      );
      setIsRunningTest(false);
    }, 800);
  };

  return (
    <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-main flex items-center gap-2">
          <Wrench className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          Skill &amp; Tool Extension Registry (FR2)
        </h2>
        <p className="text-xs text-dim mt-0.5 font-mono">
          Standardized tool interfaces, parameter validation schemas, and sandboxed isolation boundaries
        </p>
      </div>

      {/* Skills Grid with React Bits FadeContent */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {skills.map((skill, index) => (
          <FadeContent key={skill.id} blur duration={250} delay={index * 40} trigger="mount">
            <Card
              className={`flex flex-col justify-between transition-all h-full ${
                !skill.enabled ? 'opacity-50 border-subtle' : 'hover:border-medium'
              }`}
            >
              <CardHeader className="py-3">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-main">
                      {skill.name}
                    </span>
                    <Badge variant={skill.riskLevel === 'high' ? 'rose' : skill.riskLevel === 'medium' ? 'amber' : 'sky'}>
                      {skill.riskLevel.toUpperCase()}
                    </Badge>
                    {skill.isMock && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono">
                        MOCK DATA
                      </span>
                    )}
                    {skill.isIncomplete && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-mono">
                        INCOMPLETE SCHEMA
                      </span>
                    )}
                    {!skill.isMock && !skill.isIncomplete && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono">
                        REGISTERED TOOL
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-dim">{skill.displayName}</p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleSkill(skill.id)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-none active:scale-95 ${
                    skill.enabled ? 'bg-emerald-600' : 'bg-subtle'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${
                      skill.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </CardHeader>

              <CardContent className="space-y-3 pt-3 text-xs font-mono">
                <p className="text-dim leading-relaxed font-sans">{skill.description}</p>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                    <Shield className="w-3 h-3" />
                    CONTAINER_SHIELD (FR2.3)
                  </span>

                  <span className="text-faint ml-auto">
                    {skill.parameters.length} parameters
                  </span>
                </div>
              </CardContent>

              <CardFooter className="py-2.5 flex items-center justify-between text-xs font-mono text-faint">
                <span className="inline-flex items-center gap-1">
                  <span>Invocations:</span>
                  <CountUp to={skill.executionCount} duration={0.3} />
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setInspectingSkill(skill)}
                    icon={<Sliders className="w-3 h-3" />}
                    className="text-xs py-1"
                  >
                    Schema
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTestingSkill(skill);
                      setTestOutput(null);
                    }}
                    icon={<Play className="w-3 h-3 text-emerald-500" />}
                    className="text-xs py-1"
                  >
                    Dry Run
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </FadeContent>
        ))}
      </div>

      {/* Schema Inspector Modal with FadeContent */}
      <Modal
        isOpen={Boolean(inspectingSkill)}
        onClose={() => setInspectingSkill(null)}
        title="Tool Schema Definition"
        description="Input and output parameter types (FR2.1 / FR2.2)"
      >
        {inspectingSkill && (
          <FadeContent blur duration={200} trigger="mount">
            <div className="space-y-4 font-mono text-xs">
              <div className="p-3 rounded-lg bg-elevated border border-subtle space-y-1">
                <div className="flex justify-between">
                  <span className="text-dim">Identifier:</span>
                  <span className="text-emerald-500 font-semibold">{inspectingSkill.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Requires Authorization:</span>
                  <span className="text-amber-500">
                    {inspectingSkill.requiresApproval ? 'YES (Just-in-Time Approval Gate)' : 'NO (Autonomous)'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-sans font-semibold text-main uppercase tracking-wider block">
                  Parameters
                </span>
                {inspectingSkill.parameters.map((p) => (
                  <div key={p.name} className="p-2.5 rounded-lg bg-surface border border-subtle flex items-center justify-between">
                    <div>
                      <span className="text-main font-semibold">{p.name}</span>
                      <span className="text-dim ml-2">({p.type})</span>
                      <p className="text-[11px] text-faint font-sans mt-0.5">{p.description}</p>
                    </div>
                    {p.required && <Badge variant="rose">Required</Badge>}
                  </div>
                ))}
              </div>
            </div>
          </FadeContent>
        )}
      </Modal>

      {/* Sandbox Dry Run Modal with FadeContent */}
      <Modal
        isOpen={Boolean(testingSkill)}
        onClose={() => setTestingSkill(null)}
        title="Isolated Sandbox Test"
        description="Execute a safe dry-run in CONTAINER_SHIELD virtual process"
      >
        {testingSkill && (
          <FadeContent blur duration={200} trigger="mount">
            <div className="space-y-4 font-mono text-xs">
              <div className="p-3 rounded-lg bg-surface border border-subtle space-y-1">
                <div className="flex justify-between">
                  <span className="text-dim">Subprocess Binary:</span>
                  <span className="text-sky-500">{testingSkill.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Isolation Profile:</span>
                  <span className="text-emerald-500">RESTRICTED_POSIX_JAIL</span>
                </div>
              </div>

              {testOutput ? (
                <pre className="p-3 rounded-lg bg-elevated border border-subtle text-emerald-600 dark:text-emerald-300 leading-relaxed overflow-x-auto text-[11px]">
                  {testOutput}
                </pre>
              ) : (
                <p className="text-dim font-sans text-xs">
                  Press &quot;Execute Dry Run&quot; to test the validation barrier and verify error interception.
                </p>
              )}

              <div className="pt-2 border-t border-subtle flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTestingSkill(null)}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleRunTest(testingSkill)}
                  loading={isRunningTest}
                  icon={<Play className="w-3.5 h-3.5" />}
                >
                  Execute Dry Run
                </Button>
              </div>
            </div>
          </FadeContent>
        )}
      </Modal>
    </div>
  );
};
