import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Category, Report, TrainingRun } from '@/lib/model.js';
import type { OperationalPacket } from '@/lib/operational-state-machine.js';
import { collectDeficiencies, deficiencyGroupId, overrideDeficiency, reconcileDeficiencyRatings } from '@/lib/seg-deficiencies.js';

export function useDeficiencyEditor(
  report: Report | undefined,
  setReport: Dispatch<SetStateAction<Report | undefined>>,
  resolvePacket: (report: Report) => OperationalPacket,
  candidate: TrainingRun | undefined,
  editable: boolean,
) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const preview = useMemo(() => !report ? undefined : candidate
    ? { ...report, runs: report.runs.some(run => run.id === candidate.id)
      ? report.runs.map(run => run.id === candidate.id ? candidate : run) : [...report.runs, candidate] }
    : report, [report, candidate]);
  const packet = useMemo(() => preview ? resolvePacket(preview) : undefined, [preview, resolvePacket]);
  const groups = useMemo(() => preview && packet ? collectDeficiencies(preview, packet) : [], [preview, packet]);
  useEffect(() => {
    if (!report || !preview || !packet || !editable) return;
    const result = reconcileDeficiencyRatings(preview, packet);
    if (result !== preview) setReport(current => current !== report ? current : {
      ...result, runs: current.runs, ratingsReviewedAt: undefined,
    });
  }, [report, preview, packet, editable, setReport]);
  useEffect(() => {
    if (!editable || report?.limboDay) {
      if(activeId)setActiveId(null);
      return;
    }
    if (activeId && groups.some(group => group.id === activeId && group.reviewed)) return;
    if (activeId) {
      setActiveId(null);
      return;
    }
    const pending = groups.find(group => group.reviewed && !seen.current.has(group.id) && !group.narrative.trim());
    if (pending) {
      seen.current.add(pending.id);
      setActiveId(pending.id);
    } else if (activeId) setActiveId(null);
  }, [activeId, groups, editable, report?.limboDay]);
  const active = groups.find(group => group.id === activeId && group.reviewed);
  const setNarrative = (text: string) => {
    if (!active || !editable) return;
    setReport(current => !current ? current : {
      ...current, ratingsReviewedAt: undefined,
      deficiencyNarratives: { ...current.deficiencyNarratives, [active.id]: text },
    });
  };
  const override = (category: Category) => {
    if (!active || !editable) return;
    const id = deficiencyGroupId(active.runId, category);
    seen.current.add(id);
    setReport(current => current ? overrideDeficiency(current, active, category) : current);
    setActiveId(id);
  };
  return { groups, active, setNarrative, override, close: () => setActiveId(null), open: (id: string) => { if(groups.some(group=>group.id===id&&group.reviewed))setActiveId(id); },
    resetIncident: () => { seen.current.clear(); setActiveId(null); } };
}
