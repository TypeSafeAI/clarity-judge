"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { Axis, ChoiceOption } from "@/types/axis";

type Props = { onAdd: (axis: Axis) => void; initialAxis?: Axis; onCancel?: () => void };

type Kind = "yes_no" | "choice";

/** Unique-enough id for a new custom axis (timestamp in base 36). */
function newAxisId(): string {
  return `custom-${Date.now().toString(36)}`;
}

/** Turn "Mixed / inconsistent" into "mixed_inconsistent" for the option key Jev sees. */
function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "option";
}

function Segment({ active, children, ...rest }: { active: boolean; children: React.ReactNode } & React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label {...rest} className={`chip${active ? " selected" : ""}`}>
      <Check size={13} strokeWidth={2.25} aria-hidden />
      {children}
    </label>
  );
}

export function CustomAxisBuilder({ onAdd, initialAxis, onCancel }: Props) {
  const [name, setName] = useState(initialAxis?.name ?? "");
  const [kind, setKind] = useState<Kind>(initialAxis?.kind ?? "yes_no");
  const [question, setQuestion] = useState(initialAxis?.question ?? "");
  const [goodLooksLike, setGoodLooksLike] = useState(initialAxis?.goodLooksLike ?? "");
  const [yesIsIssue, setYesIsIssue] = useState(initialAxis?.kind === "yes_no" ? initialAxis.issueWhen : false);
  const [optionsText, setOptionsText] = useState(initialAxis?.kind === "choice" ? initialAxis.options.map((option) => option.label).join("\n") : "");
  const [editedOptions, setEditedOptions] = useState<ChoiceOption[]>(initialAxis?.kind === "choice" ? initialAxis.options : []);
  const [issueOptions, setIssueOptions] = useState<string[]>(initialAxis?.kind === "choice" ? initialAxis.issueOptions : []);
  const [error, setError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (initialAxis) nameRef.current?.focus(); }, [initialAxis]);

  const parsedOptions = optionsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const editingChoice = initialAxis?.kind === "choice";
  const options = editingChoice
    ? editedOptions.map((option) => ({ ...option, label: option.label.trim() }))
    : parsedOptions.map((label) => ({ value: slugify(label), label }));
  const duplicateKeys = new Set(options.map((option) => option.value)).size !== options.length;
  const duplicateLabels = new Set(options.map((option) => option.label.toLowerCase())).size !== options.length;

  function reset() {
    setName("");
    setKind("yes_no");
    setQuestion("");
    setGoodLooksLike("");
    setYesIsIssue(false);
    setOptionsText("");
    setIssueOptions([]);
    setError(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Give the check a name.");
    if (!question.trim()) return setError("Write the question Jev should answer.");
    if (kind === "choice" && options.length < 2) return setError(editingChoice ? "Add at least two options." : "Add at least two options, one per line.");

    if (kind === "choice" && options.some((option) => !option.label)) return setError("Give every option a label.");
    if (kind === "choice" && duplicateKeys) return setError(editingChoice ? "Each option must have a unique key." : "Give each option a unique name; these labels produce the same option key.");
    if (kind === "choice" && duplicateLabels) return setError("Give each option a distinct label.");

    const base = {
      id: initialAxis?.id ?? newAxisId(),
      name: name.trim(),
      description: goodLooksLike.trim() || question.trim(),
      question: question.trim(),
      goodLooksLike: goodLooksLike.trim() || undefined,
      builtIn: false,
      evidenceHint: initialAxis?.evidenceHint ?? { keywords: [] },
    };
    const axis: Axis =
      kind === "yes_no"
        ? { ...(initialAxis?.kind === "yes_no" ? initialAxis : {}), ...base, kind: "yes_no", issueWhen: yesIsIssue }
        : {
            ...base,
            kind: "choice",
            options,
            issueOptions: issueOptions.filter((value) => options.some((option) => option.value === value)),
          };
    onAdd(axis);
    if (!initialAxis) reset();
  }

  return (
    <form onSubmit={submit}>
      <label>
        Name
        <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Is this on-brand?" maxLength={80} />
      </label>

      <fieldset className="chip-fieldset">
        <legend className="field-label">Answer type</legend>
        <div className="field-options segmented">
          {(["yes_no", "choice"] as Kind[]).map((value) => (
            <Segment key={value} active={kind === value}>
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
              {value === "yes_no" ? "Yes / No" : "Pick one"}
            </Segment>
          ))}
        </div>
      </fieldset>

      <label style={{ marginTop: 14 }}>
        Question to ask
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={kind === "yes_no" ? "Does this text sound like our brand voice?" : "Which audience is this text written for?"}
        />
      </label>
      {kind === "yes_no" && <span className="field-hint">Phrase it so that &ldquo;yes&rdquo; has one clear meaning.</span>}

      {kind === "yes_no" ? (
        <fieldset className="chip-fieldset">
          <legend className="field-label">A &ldquo;yes&rdquo; answer means</legend>
          <div className="field-options segmented">
            <Segment active={!yesIsIssue}>
              <input type="radio" name="yesMeans" checked={!yesIsIssue} onChange={() => setYesIsIssue(false)} />
              The text passes
            </Segment>
            <Segment active={yesIsIssue}>
              <input type="radio" name="yesMeans" checked={yesIsIssue} onChange={() => setYesIsIssue(true)} />
              There&apos;s a problem
            </Segment>
          </div>
        </fieldset>
      ) : (
        <>
          {editingChoice ? (
            <fieldset className="chip-fieldset">
              <legend className="field-label">Answer options</legend>
              {editedOptions.map((option, index) => (
                <div key={option.value}>
                  <label>
                    Option {index + 1} label
                    <input value={option.label} onChange={(event) => setEditedOptions((previous) => previous.map((entry) => entry.value === option.value ? { ...entry, label: event.target.value } : entry))} />
                  </label>
                  <div className="field-options">
                    <button type="button" className="button quiet" aria-label={`Move option ${index + 1} up`} disabled={index === 0} onClick={() => setEditedOptions((previous) => {
                      const next = [...previous];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      return next;
                    })}>Move up</button>
                    <button type="button" className="button quiet" aria-label={`Remove option ${index + 1}`} onClick={() => {
                      setEditedOptions((previous) => previous.filter((entry) => entry.value !== option.value));
                      setIssueOptions((previous) => previous.filter((value) => value !== option.value));
                    }}>Remove option</button>
                  </div>
                </div>
              ))}
              <button type="button" className="button small" onClick={() => setEditedOptions((previous) => [...previous, { value: `option_${crypto.randomUUID()}`, label: "" }])}>Add option</button>
            </fieldset>
          ) : <label style={{ marginTop: 14 }}>
            Options (one per line)
            <textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={3} placeholder={"Engineers\nExecutives\nGeneral public"} />
          </label>}
          {options.length > 0 && (
            <fieldset className="chip-fieldset">
              <legend className="field-label">
                Which options count as a problem? <span className="muted">(optional)</span>
              </legend>
              <div className="field-options">
                {options.map(({ label, value }, index) => {
                  const checked = issueOptions.includes(value);
                  return (
                    <Segment key={`${value}-${index}`} active={checked}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setIssueOptions((prev) => (checked ? prev.filter((v) => v !== value) : [...prev, value]))}
                      />
                      {label || `Option ${index + 1} (unnamed)`}
                    </Segment>
                  );
                })}
              </div>
            </fieldset>
          )}
        </>
      )}

      <label style={{ marginTop: 14 }}>
        What does &ldquo;good&rdquo; look like? <span className="muted">(optional)</span>
        <textarea
          value={goodLooksLike}
          onChange={(e) => setGoodLooksLike(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Short, warm, no corporate jargon, speaks directly to the reader."
        />
      </label>
      <span className="field-hint">Sent to Jev alongside the question as extra context. Custom checks are saved in this browser.</span>

      <section className="check-preview" aria-label="Check preview" aria-live="polite" aria-atomic="true">
        <h3>Check preview</h3>
        <p><strong>Question:</strong> {question.trim() || "Write a question to preview it here."}</p>
        <p><strong>Options:</strong> {kind === "yes_no" ? "Yes · No" : options.map((option) => option.label).join(" · ") || "Add answer options."}</p>
        <p><strong>Counts as an issue:</strong> {kind === "yes_no" ? (yesIsIssue ? "Yes" : "No") : options.filter((option) => issueOptions.includes(option.value)).map((option) => option.label).join(" · ") || "None of the options"}</p>
        {goodLooksLike.trim() && <p><strong>Good looks like:</strong> {goodLooksLike.trim()}</p>}
      </section>

      {error && (
        <p className="field-hint" role="alert" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}

      <div className="dialog-actions">
        <button type="submit" className="button primary">
          {initialAxis ? "Save changes" : "Save check"}
        </button>
        <button type="button" className="button quiet" onClick={initialAxis ? onCancel : reset}>
          {initialAxis ? "Cancel editing" : "Reset"}
        </button>
      </div>
    </form>
  );
}
