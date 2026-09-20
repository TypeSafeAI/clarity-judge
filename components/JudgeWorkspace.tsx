"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { Axis } from "@/types/axis";
import type { JevErrorPayload } from "@/types/jev";
import { JevApiError } from "@/types/jev";
import type { AxisResult, JudgmentStatus } from "@/types/results";
import { BUILT_IN_AXES } from "@/lib/builtInAxes";
import { runJudgmentDetailed } from "@/lib/judge";
import { buildSummary } from "@/lib/results";
import { SAMPLE_TEXT } from "@/lib/sampleText";
import { redactSecrets } from "@/lib/redact";
import { DEFAULT_SETTINGS, loadCustomAxes, loadSettings, saveCustomAxes, saveSettings } from "@/lib/storage";
import { CommandPalette, type Command } from "./CommandPalette";
import { ResultsPanel } from "./ResultsPanel";
import { useShell } from "./ShellContext";
import { SourcePanel } from "./SourcePanel";
import { Heading, RunButton } from "./ui";

/**
 * The judge workspace. All judgment state lives here; the two panels are
 * presentational. Keys and telemetry live in the shell so the topbar can show them.
 */
export function JudgeWorkspace() {
  const { apiKey, demoMode, hydrated, setTelemetry, setRunning, openKeyDialog, paletteOpen, setPaletteOpen, modKey } = useShell();

  const [text, setText] = useState(SAMPLE_TEXT);
  const [previousText, setPreviousText] = useState<string | null>(null);
  const [replacementMessage, setReplacementMessage] = useState("");
  const [evidenceReturn, setEvidenceReturn] = useState<{ target: HTMLElement; name: string; signature: string; runId: number } | null>(null);
  const [customAxes, setCustomAxes] = useState<Axis[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(DEFAULT_SETTINGS.selectedAxisIds));
  const [threshold, setThreshold] = useState(DEFAULT_SETTINGS.threshold);
  const [status, setStatus] = useState<JudgmentStatus>("idle");
  const [results, setResults] = useState<AxisResult[]>([]);
  const [error, setError] = useState<JevErrorPayload | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [runId, setRunId] = useState(0);
  const [snapshot, setSnapshot] = useState("");
  const [judgedText, setJudgedText] = useState("");
  // Whether the results on screen came from the mock, decided when they arrived.
  const [resultsSimulated, setResultsSimulated] = useState(false);
  const autoRan = useRef(false);

  // localStorage only exists in the browser and the first client render must
  // match the server HTML, so saved settings load in an effect after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomAxes(loadCustomAxes());
    const settings = loadSettings();
    setThreshold(settings.threshold);
    setSelectedIds(new Set(settings.selectedAxisIds));
    setSettingsLoaded(true);
  }, []);
  useEffect(() => {
    if (settingsLoaded) saveCustomAxes(customAxes);
  }, [customAxes, settingsLoaded]);
  useEffect(() => {
    if (settingsLoaded) saveSettings({ threshold, selectedAxisIds: [...selectedIds] });
  }, [threshold, selectedIds, settingsLoaded]);

  const allAxes = useMemo(() => [...BUILT_IN_AXES, ...customAxes], [customAxes]);
  const selectedAxes = useMemo(() => allAxes.filter((axis) => selectedIds.has(axis.id)), [allAxes, selectedIds]);

  // What the last run was based on, so the results can say when they're stale.
  const signature = useMemo(() => JSON.stringify([text, selectedAxes.map((a) => a.id), demoMode]), [text, selectedAxes, demoMode]);
  const stale = !!snapshot && snapshot !== signature && status === "done";

  const run = useCallback(async () => {
    if (!text.trim()) {
      setError({ error: "Add some text to judge first.", code: "validation" });
      setStatus("error");
      return;
    }
    if (selectedAxes.length === 0) {
      setError({ error: "Switch on at least one check.", code: "validation" });
      setStatus("error");
      return;
    }
    setStatus("running");
    setEvidenceReturn(null);
    setRunning(true);
    setError(null);
    try {
      const { results: next, telemetry } = await runJudgmentDetailed(text, selectedAxes, {
        demoMode,
        apiKey: apiKey ?? undefined,
        jevEvidence: true,
      });
      setResults(next);
      setResultsSimulated(telemetry.source === "simulated");
      setTelemetry(telemetry);
      setSnapshot(JSON.stringify([text, selectedAxes.map((a) => a.id), demoMode]));
      setJudgedText(text);
      setRunId((id) => id + 1);
      setStatus("done");
    } catch (caught) {
      const payload: JevErrorPayload =
        caught instanceof JevApiError
          ? { error: caught.message, code: caught.code, status: caught.status, raw: caught.raw }
          : { error: "Something went wrong.", code: "unknown", raw: caught instanceof Error ? caught.message : String(caught) };
      // Belt and braces: never let a key reach the screen via an error message.
      setError({ ...payload, error: redactSecrets(payload.error) ?? payload.error, raw: redactSecrets(payload.raw) });
      setStatus("error");
    } finally {
      setRunning(false);
    }
  }, [text, selectedAxes, demoMode, apiKey, setRunning, setTelemetry]);

  // Demo mode runs once automatically so the results panel isn't empty on first
  // load. Live mode never spends credits without a click.
  useEffect(() => {
    if (hydrated && settingsLoaded && demoMode && !autoRan.current) {
      autoRan.current = true;
      void run();
    }
  }, [hydrated, settingsLoaded, demoMode, run]);

  // ⌘K / Ctrl+K opens the command palette; ⌘↵ runs from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(!paletteOpen);
      } else if (event.key === "Enter") {
        event.preventDefault();
        void run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, paletteOpen, setPaletteOpen]);

  function toggleAxis(id: string) {
    setEvidenceReturn(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll(select: boolean) {
    setEvidenceReturn(null);
    setSelectedIds(select ? new Set(allAxes.map((a) => a.id)) : new Set());
  }
  function addCustomAxis(axis: Axis) {
    setEvidenceReturn(null);
    setCustomAxes((prev) => [...prev, axis]);
    setSelectedIds((prev) => new Set(prev).add(axis.id));
  }
  function removeCustomAxis(id: string) {
    setEvidenceReturn(null);
    setCustomAxes((prev) => prev.filter((a) => a.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setResults((prev) => prev.filter((r) => r.axis.id !== id));
  }

  const summary = useMemo(() => (results.length ? buildSummary(results, threshold) : null), [results, threshold]);
  const running = status === "running";
  const canReturnToEvidence = evidenceReturn && evidenceReturn.signature === signature && evidenceReturn.runId === runId && status === "done";

  function focusWriting() {
    const editor = document.getElementById("judge-text");
    editor?.scrollIntoView({ block: "center" });
    editor?.focus({ preventScroll: true });
  }

  function focusVerdicts() {
    const heading = document.getElementById("results-title");
    const main = heading?.closest("main");
    if (heading && main) {
      main.scrollTop += heading.getBoundingClientRect().top - main.getBoundingClientRect().top - 16;
    }
    heading?.focus({ preventScroll: true });
  }

  function replaceText(next: string, message: string) {
    if (next === text) return;
    setPreviousText(text);
    setText(next);
    setEvidenceReturn(null);
    setReplacementMessage(`${message} Undo is available.`);
  }

  function undoReplacement() {
    if (previousText === null) return;
    setText(previousText);
    setPreviousText(null);
    setEvidenceReturn(null);
    setReplacementMessage("Previous text restored.");
    focusWriting();
  }

  const commands: Command[] = [
    { id: "run", group: "Judge", label: "Run judgment", hint: `${modKey} ↵`, run: () => void run() },
    { id: "sample", group: "Text", label: "Load sample text", run: () => replaceText(SAMPLE_TEXT, "Sample loaded.") },
    { id: "clear-text", group: "Text", label: "Clear text", run: () => replaceText("", "Text cleared.") },
    { id: "all", group: "Checks", label: "Select all checks", run: () => selectAll(true) },
    { id: "none", group: "Checks", label: "Clear all checks", run: () => selectAll(false) },
    ...allAxes.map((axis) => ({
      id: `toggle-${axis.id}`,
      group: "Checks",
      label: `${selectedIds.has(axis.id) ? "Disable" : "Enable"} ${axis.name}`,
      hint: selectedIds.has(axis.id) ? "on" : "off",
      keepOpen: true,
      run: () => toggleAxis(axis.id),
    })),
    {
      id: "theme",
      group: "View",
      label: "Toggle light / dark",
      run: () => document.querySelector<HTMLButtonElement>('button[aria-label^="Switch to"]')?.click(),
    },
    { id: "key", group: "View", label: "API key settings", run: openKeyDialog },
    { id: "docs", group: "Help", label: "Open TypeSafe docs", hint: "↗", run: () => window.open("https://docs.typesafe.ai", "_blank", "noreferrer") },
  ];

  return (
    <div className="workspace">
      <Heading
        title={
          <>
            Decisions, <span>not scores.</span>
          </>
        }
        description="Separate, named checks. Each one is a closed question for Jev, answered with its own verdict, confidence, and a relevant source sentence."
      >
        <span className="pill">
          <ShieldCheck size={14} />
          Classification only · nothing is rewritten
        </span>
      </Heading>

      <div className="split">
        <SourcePanel
          text={text}
          onText={(value) => { setText(value); setEvidenceReturn(null); }}
          onLoadSample={() => replaceText(SAMPLE_TEXT, "Sample loaded.")}
          onClear={() => replaceText("", "Text cleared.")}
          onLoadExample={(value) => replaceText(value, "Example loaded.")}
          canUndo={previousText !== null}
          onUndo={undoReplacement}
          replacementMessage={replacementMessage}
          evidenceReturnName={canReturnToEvidence ? evidenceReturn.name : undefined}
          onReturnToEvidence={() => {
            if (!canReturnToEvidence) return;
            if (evidenceReturn.target.isConnected) {
              evidenceReturn.target.scrollIntoView({ block: "center" });
              evidenceReturn.target.focus({ preventScroll: true });
            } else {
              focusVerdicts();
            }
            setEvidenceReturn(null);
          }}
          builtInAxes={BUILT_IN_AXES}
          customAxes={customAxes}
          selectedIds={selectedIds}
          onToggle={toggleAxis}
          onSelectAll={selectAll}
          onAddCustom={addCustomAxis}
          onRemoveCustom={removeCustomAxis}
          demoMode={demoMode}
          running={running}
          onRun={() => void run()}
          runHint={`${modKey} ↵`}
        />
        <ResultsPanel
          status={status}
          results={results}
          summary={summary}
          error={error}
          stale={stale}
          threshold={threshold}
          onThresholdChange={setThreshold}
          onRetry={() => void run()}
          canRun={!!text.trim() && selectedAxes.length > 0}
          onChangeKey={openKeyDialog}
          onLocateEvidence={(snippet, trigger, name) => {
            const editor = document.getElementById("judge-text") as HTMLTextAreaElement | null;
            if (!editor) return;
            const start = editor.value.indexOf(snippet);
            if (start < 0) return;
            const target = trigger.closest(".result-card")?.querySelector<HTMLElement>(":scope > summary");
            if (target) setEvidenceReturn({ target, name, signature, runId });
            focusWriting();
            editor.setSelectionRange(start, start + snippet.length);
          }}
          demoMode={demoMode}
          resultsSimulated={resultsSimulated}
          runId={runId}
          exportData={
            results.length
              ? { text: judgedText, threshold, mode: resultsSimulated ? "simulated" : "jev", results: results.map(({ axis, ...rest }) => ({ check: axis.name, ...rest })) }
              : null
          }
        />
      </div>

      <div className="workspace-actions">
        <nav aria-label="Workspace shortcuts">
          <button type="button" className="button quiet" onClick={focusWriting}>Writing</button>
          <button type="button" className="button quiet" onClick={focusVerdicts}>Verdicts</button>
        </nav>
        <RunButton busy={running} disabled={!text.trim() || selectedAxes.length === 0} onClick={() => void run()}>Run judgment</RunButton>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </div>
  );
}
