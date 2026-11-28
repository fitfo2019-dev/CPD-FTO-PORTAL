import React,{ useCallback, useEffect, useRef, useState } from 'react';
import { Search, RotateCw, PenLine } from 'lucide-react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.js';
import { PRIMARY_RUN_FORMS, type PrimaryRunForm } from '@/lib/model.js';
import { formatDateDMY, formatDateTimeMDY } from '@/lib/training-calendar.js';
import { lookupDispatchIncident } from '@/components/dispatch-incident-lookup.js';
import { applyCurrentDateTimeShortcut } from '@/lib/date-time-shortcut.js';
import { applyDispatchIncidentRetry, type DispatchIncidentDraftFields, type DispatchIncidentPrefill } from '@/lib/dispatch-prefill.js';
import { TrafficStopRiskPrompt } from '@/components/traffic-stop-risk-choice.js';
import { CLEARANCE_CODES, isValidRadioCode, isValidSituationFoundCode, normalizeRadioCode, normalizeSituationFoundCode, RADIO_CODES, suggestRunTypeFromDispatchedCode } from '@/lib/radio-codes.js';

export type NewRunSeed = {
  incidentNumber: string;
  unitNumber: string;
  location: string;
  locationCity: string;
  locationState: string;
  locationZip: string;
  zone: string;
  cruiserDistrict: string;
  occurredAtText: string;
  dispatchedAtText: string;
  clearedAtText: string;
  dispatchedCode: string;
  situationFoundCode: string;
  clearanceCode: ''|'1V'|'2V'|'3V'|'4V';
  runKind: PrimaryRunForm;
  fromDispatch: boolean;
};

type Phase = 'ask' | 'loading' | 'choose' | 'review' | 'failed';
const inp = 'h-10 w-full rounded border bg-card px-3 text-sm';

export function NewRunDialog({ open, defaultUnit, contextKey = '', onCancel, onConfirm }: {
  open: boolean;
  defaultUnit: string;
  contextKey?: string;
  onCancel: () => void;
  onConfirm: (seed: NewRunSeed) => void;
}) {
  const [phase, setPhase] = useState<Phase>('ask');
  const [incident, setIncident] = useState('');
  const [unit, setUnit] = useState(defaultUnit);
  const [failure, setFailure] = useState('');
  const [lookupFailure, setLookupFailure] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [fromDispatch, setFromDispatch] = useState(false);
  const [location, setLocation] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationZip, setLocationZip] = useState('');
  const [zone, setZone] = useState('');
  const [cruiserDistrict, setCruiserDistrict] = useState('');
  const [occurred, setOccurred] = useState('');
  const [dispatchedAt, setDispatchedAt] = useState('');
  const [clearedAt, setClearedAt] = useState('');
  const [code, setCode] = useState('');
  const [situationFoundCode, setSituationFoundCode] = useState('');
  const [clearanceCode, setClearanceCode] = useState<NewRunSeed['clearanceCode']>('');
  const [kind, setKind] = useState<PrimaryRunForm | ''>('');
  const [riskPrompt,setRiskPrompt]=useState(false);
  const [riskUnanswered,setRiskUnanswered]=useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const [candidates, setCandidates] = useState<DispatchIncidentPrefill[]>([]);
  const [chooseReason, setChooseReason] = useState<'choose_unit' | 'ambiguous'>('ambiguous');
  const [picked, setPicked] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  // Values CAD returned for the FTO's own cruiser; a field shows From CAD while it still holds that value.
  const [cadCodes, setCadCodes] = useState({ situationFoundCode: '', clearanceCode: '' });
  const fromCad = (value: string, cad: string) => fromDispatch && !!cad && value === cad;
  const lookupBaselineRef = useRef<DispatchIncidentDraftFields | null>(null);
  const draftFieldsNow: DispatchIncidentDraftFields = {
    location, locationCity, locationState, locationZip, zone, cruiserDistrict,
    occurredAtText: occurred, dispatchedAtText: dispatchedAt, clearedAtText: clearedAt,
    dispatchedCode: code, situationFoundCode, clearanceCode,
  };
  const draftFieldsRef = useRef(draftFieldsNow);
  draftFieldsRef.current = draftFieldsNow;
  const defaultUnitRef = useRef(defaultUnit);
  defaultUnitRef.current = defaultUnit;
  const previousDefaultUnit = useRef(defaultUnit);
  const cancelPending = useCallback(() => { requestIdRef.current += 1; abortRef.current?.abort(); abortRef.current = null; },[]);
  // Editing the number or unit invalidates any in-flight or unaccepted lookup result.
  const currentDraftFields = () => draftFieldsRef.current;
  const editIncident = (value: string) => {
    setIncident(value);
    lookupBaselineRef.current = null;
    if (lookupLoading || phase === 'loading' || phase === 'choose' || phase === 'failed') {
      setLookupLoading(false);
      cancelPending(); setPhase('ask'); setCandidates([]); setPicked(null); setLookupFailure('');
    }
  };
  const editUnit = (value: string) => {
    setUnit(value);
    lookupBaselineRef.current = null;
    if (lookupLoading || phase === 'loading' || phase === 'choose' || phase === 'failed') {
      setLookupLoading(false);
      cancelPending(); setPhase('ask'); setCandidates([]); setPicked(null); setLookupFailure('');
    }
  };
  const applyMatch = (p: DispatchIncidentPrefill, preserveEdits = false) => {
    const fields = preserveEdits && lookupBaselineRef.current
      ? applyDispatchIncidentRetry(currentDraftFields(), lookupBaselineRef.current, {
        location: p.locationAddress ?? p.location,
        locationCity: p.locationCity,
        locationState: p.locationState,
        locationZip: p.locationZip,
        zone: p.zone,
        cruiserDistrict: p.cruiserDistrict,
        occurredAtText: p.eventIngressAt ? formatDateTimeMDY(p.eventIngressAt) : p.eventDate ? formatDateDMY(p.eventDate) : undefined,
        dispatchedAtText: p.dispatchedAt ? formatDateTimeMDY(p.dispatchedAt) : undefined,
        clearedAtText: p.clearedAt ? formatDateTimeMDY(p.clearedAt) : undefined,
        dispatchedCode: p.dispatchedCode,
        situationFoundCode: p.situationFoundCode,
        clearanceCode: p.clearanceCode,
      })
      : undefined;
    if (preserveEdits) {
      setFromDispatch(true);
      setLocation(fields?.location ?? location);
      setLocationCity(fields?.locationCity ?? locationCity);
      setLocationState(fields?.locationState ?? locationState);
      setLocationZip(fields?.locationZip ?? locationZip);
      setZone(fields?.zone ?? zone);
      setCruiserDistrict(fields?.cruiserDistrict ?? cruiserDistrict);
      setOccurred(fields?.occurredAtText ?? occurred);
      setDispatchedAt(fields?.dispatchedAtText ?? dispatchedAt);
      setClearedAt(fields?.clearedAtText ?? clearedAt);
      setCode(normalizeRadioCode(fields?.dispatchedCode ?? code));
      setSituationFoundCode(normalizeSituationFoundCode(fields?.situationFoundCode ?? situationFoundCode));
      setClearanceCode(fields?.clearanceCode ?? clearanceCode);
      setCadCodes({ situationFoundCode: p.situationFoundCode ?? '', clearanceCode: p.clearanceCode ?? '' });
      setLookupFailure('');
      setFailure('');
      setConfirmed(false);
      setPhase('review');
      return;
    }
    setFromDispatch(true);
    setIncident(p.incidentNumber);
    if (p.unitNumber) setUnit(p.unitNumber);
    setLocation(fields?.location ?? p.locationAddress ?? p.location ?? '');
    setLocationCity(fields?.locationCity ?? p.locationCity ?? '');
    setLocationState(fields?.locationState ?? p.locationState ?? '');
    setLocationZip(fields?.locationZip ?? p.locationZip ?? '');
    setZone(fields?.zone ?? p.zone ?? '');
    setCruiserDistrict(fields?.cruiserDistrict ?? p.cruiserDistrict ?? '');
    setOccurred(fields?.occurredAtText ?? (p.eventIngressAt ? formatDateTimeMDY(p.eventIngressAt) : p.eventDate ? formatDateDMY(p.eventDate) : ''));
    setDispatchedAt(fields?.dispatchedAtText ?? (p.dispatchedAt ? formatDateTimeMDY(p.dispatchedAt) : ''));
    setClearedAt(fields?.clearedAtText ?? (p.clearedAt ? formatDateTimeMDY(p.clearedAt) : ''));
    setCode(normalizeRadioCode(fields?.dispatchedCode ?? p.dispatchedCode ?? ''));
    setSituationFoundCode(normalizeSituationFoundCode(fields?.situationFoundCode ?? p.situationFoundCode ?? ''));
    setClearanceCode(fields?.clearanceCode ?? p.clearanceCode ?? '');
    setCadCodes({ situationFoundCode: p.situationFoundCode ?? '', clearanceCode: p.clearanceCode ?? '' });
    const suggestion=suggestRunTypeFromDispatchedCode(p.dispatchedCode ?? '');
    setKind(suggestion.status==='ambiguous'?'':suggestion.runKind);
    const trafficStop=normalizeRadioCode(p.dispatchedCode??'')==='6';
    setRiskUnanswered(trafficStop);
    setRiskPrompt(trafficStop);
    setConfirmed(false);
    setLookupFailure('');
    setFailure('');
    setPhase('review');
  };

  const updateDispatchedCode = (value:string) => {
    const normalized=normalizeRadioCode(value);
    setFailure('');
    setCode(normalized);
    if(normalized===code)return;
    const suggestion=suggestRunTypeFromDispatchedCode(normalized);
    setKind(suggestion.status==='ambiguous'?'':suggestion.runKind);
    setRiskUnanswered(normalized==='6');
  };

  const askStopRisk=()=>{
    if(!riskUnanswered)return false;
    setRiskPrompt(true);
    return true;
  };
  const submitReviewedRun = (keyboardConfirmation = false,selectedKind:PrimaryRunForm|''=kind,riskAnswered=false) => {
    if(riskUnanswered&&!riskAnswered){setRiskPrompt(true);return;}
    if (!selectedKind || (!confirmed && !keyboardConfirmation)) return;
    if(!isValidRadioCode(code)||!isValidSituationFoundCode(situationFoundCode)){
      setFailure('Enter a valid dispatched or situation-found code using digits and optional letters.');
      return;
    }
    if(locationState&&!/^[A-Z]{2}$/.test(locationState)){
      setFailure('Enter a two-letter state abbreviation or leave State blank.');
      return;
    }
    if(locationZip&&!/^\d{5}(?:-\d{4})?$/.test(locationZip)){
      setFailure('Enter a 5-digit ZIP code, an optional 4-digit extension, or leave ZIP blank.');
      return;
    }
    setFailure('');
    onConfirm({
      incidentNumber: incident.trim(),
      unitNumber: unit.trim(),
      location: location.trim(),
      locationCity: locationCity.trim(),
      locationState: locationState.trim(),
      locationZip: locationZip.trim(),
      zone: zone.trim(),
      cruiserDistrict: cruiserDistrict.trim(),
      occurredAtText: occurred.trim(),
      dispatchedAtText: dispatchedAt.trim(),
      clearedAtText: clearedAt.trim(),
      dispatchedCode: code.trim(),
      situationFoundCode: situationFoundCode.trim(),
      clearanceCode,
      runKind: selectedKind,
      fromDispatch,
    });
  };

  useEffect(() => {
    if (!open) return;
    setPhase('ask'); setIncident(''); setUnit(defaultUnitRef.current); setFailure(''); setLookupFailure(''); setLookupLoading(false); setFromDispatch(false);
    setLocation(''); setLocationCity(''); setLocationState(''); setLocationZip(''); setZone(''); setCruiserDistrict('');
    setOccurred(''); setDispatchedAt(''); setClearedAt(''); setCode(''); setSituationFoundCode(''); setClearanceCode(''); setKind('');
    setRiskPrompt(false);setRiskUnanswered(false);
    setCandidates([]); setPicked(null); setConfirmed(false); lookupBaselineRef.current = null;
    return () => cancelPending();
  }, [open,cancelPending]);
  useEffect(() => {
    cancelPending();
    setLookupLoading(false);
    setCandidates([]); setPicked(null);
    setPhase(current => current === 'loading' || current === 'choose' ? 'ask' : current);
    const previous=previousDefaultUnit.current;
    setUnit(current=>current===previous?defaultUnit:current);
    previousDefaultUnit.current=defaultUnit;
    setConfirmed(false);
    // Profile refreshes never clear authored or already corrected run fields.
  }, [contextKey, defaultUnit, cancelPending]);
  useEffect(()=>{setConfirmed(false);setFailure('');},[incident,unit,location,locationCity,locationState,locationZip,zone,cruiserDistrict,occurred,dispatchedAt,clearedAt,code,situationFoundCode,clearanceCode]);

  const runLookup = async () => {
    const inc = incident.trim(); const un = unit.trim();
    if (!inc || !un) return;
    const returnToReview = phase === 'review';
    if (!lookupBaselineRef.current) lookupBaselineRef.current = currentDraftFields();
    cancelPending();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestIdRef.current;
    setLookupLoading(true);
    setFailure('');
    if (!returnToReview) setPhase('loading');
    const result = await lookupDispatchIncident(inc, un, controller.signal);
    // Reject stale results: a newer request, an edit, or a close supersedes this one.
    if (controller.signal.aborted || requestId !== requestIdRef.current || result.status === 'aborted') return;
    abortRef.current = null;
    setLookupLoading(false);
    if (result.status === 'matched') applyMatch(result.match, returnToReview);
    else if (result.status === 'choose') { setCandidates(result.matches); setChooseReason(result.reason); setPicked(null); setPhase('choose'); }
    else {
      const message = result.status === 'empty' ? `No dispatch record for incident ${inc} on unit ${un} was found.` : result.message;
      setLookupFailure(message);
      if (!returnToReview) setPhase('failed');
    }
  };
  const manual = () => { cancelPending(); setLookupLoading(false); setFromDispatch(false); setFailure(''); setConfirmed(false); setPhase('review'); };

  return <React.Fragment><AlertDialog open={open} onOpenChange={next => { if (!next) { cancelPending(); onCancel(); } }}>
    <AlertDialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto" data-testid="dialog-new-run">
      <AlertDialogHeader>
        <AlertDialogTitle>{phase === 'review' ? 'Confirm run details' : 'Start a new run'}</AlertDialogTitle>
        <AlertDialogDescription>
          {phase === 'review'
            ? fromDispatch ? 'Dispatch details were returned as a draft. Every field is editable; correct anything that is wrong before opening the run sheet.' : 'Enter the run details manually. Nothing was imported.'
            : 'Enter the incident number. Lookup runs only when you select Look up; your unit number keeps the match to your own unit.'}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {(phase === 'ask' || phase === 'loading' || phase === 'failed' || phase === 'choose') && <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1"><span className="label-caps">Incident / run number</span><input autoFocus className={inp + ' mono'} value={incident} maxLength={120} onChange={e => editIncident(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void runLookup(); } }} data-testid="input-new-run-incident" /></label>
        <label className="block space-y-1"><span className="label-caps">Unit / cruiser assignment</span><input className={inp + ' mono'} value={unit} maxLength={40} onChange={e => editUnit(e.target.value)} placeholder="Assigned unit or cruiser" data-testid="input-new-run-unit" /></label>
        {!unit.trim() && <p className="text-xs text-muted-foreground sm:col-span-2">Enter the unit or cruiser assignment from Reporting for Duty. This editable value identifies your unit when multiple officers share an incident.</p>}
        {phase === 'loading' && <div className="h-10 animate-pulse rounded bg-muted sm:col-span-2" role="status" aria-label="Looking up incident" />}
        {phase === 'failed' && <div role="alert" className="rounded border border-warn/60 bg-warn/10 p-3 text-sm sm:col-span-2" data-testid="text-lookup-failed">
          <b>{lookupFailure}</b> No dispatch data was added. Retry, or continue with manual entry; the incident number you typed is kept.
        </div>}
        {phase === 'choose' && <fieldset className="sm:col-span-2" data-testid="list-dispatch-candidates">
          <legend className="text-sm font-semibold">{chooseReason === 'choose_unit' ? 'Several units are on this incident. Select your own unit record.' : 'More than one record matches. Select the correct record.'}</legend>
          <ul className="mt-2 max-h-60 divide-y overflow-y-auto rounded border bg-card">
          {candidates.map((c, i) => <li key={i}><label className="flex cursor-pointer items-start gap-2 p-2 text-sm">
              <input type="radio" name="dispatch-candidate" checked={picked === i} onChange={() => setPicked(i)} data-testid={`radio-dispatch-candidate-${i}`} />
              <span><b className="mono">{c.unitNumber || 'No unit listed'}</b> · {c.incidentNumber}{c.dispatchedCode ? ` · 10-${c.dispatchedCode}` : ''}{c.location ? ` · ${c.location}` : ''}{c.dispatchedAt ? ` · dispatched ${formatDateTimeMDY(c.dispatchedAt)}` : ''}</span>
            </label></li>)}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">Nothing is selected for you. Only choose a record for your own unit; another unit's times do not belong on this run.</p>
        </fieldset>}
      </div>}

      {phase === 'review' && <div className="grid gap-3 sm:grid-cols-2">
        {failure&&<div role="alert" className="rounded border border-warn/60 bg-warn/10 p-3 text-sm sm:col-span-2">{failure}</div>}
        {lookupFailure&&<div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded border border-warn/60 bg-warn/10 p-3 text-sm sm:col-span-2" data-testid="text-review-lookup-failed">
          <span><b>{lookupFailure}</b> Manual entries are kept.</span>
          <button type="button" disabled={lookupLoading || !incident.trim() || !unit.trim()} onClick={() => void runLookup()} className="inline-flex min-h-10 items-center gap-1.5 rounded border bg-card px-3 font-semibold disabled:opacity-50" data-testid="button-review-dispatch-retry"><RotateCw className="h-4 w-4" />{lookupLoading ? 'Retrying…' : 'Retry lookup'}</button>
        </div>}
        <label className="block space-y-1 sm:col-span-2"><span className="label-caps">Primary run type · required</span>
          <select className={inp} value={kind} onChange={e => {
            const next=e.target.value as PrimaryRunForm;
            setFailure('');setConfirmed(false);setKind(next);
            const stop=next==='traffic_stop'||next==='high_risk_stop';
            setRiskUnanswered(stop);
            if(stop){setCode(current=>current||'6');setRiskPrompt(true);}
          }} data-testid="select-new-run-kind">
            <option value="" disabled>Select the primary form</option>
            {PRIMARY_RUN_FORMS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {!kind && <span className="text-xs text-muted-foreground">Choose the primary form to continue.</span>}
        </label>
        <label className="block space-y-1"><span className="label-caps">Incident / run number</span><input className={inp + ' mono'} value={incident} maxLength={120} onChange={e => setIncident(e.target.value)} data-testid="input-review-incident" /></label>
        <label className="block space-y-1"><span className="label-caps">Unit / cruiser assignment</span><input className={inp + ' mono'} value={unit} maxLength={40} onChange={e => setUnit(e.target.value)} data-testid="input-review-unit" /></label>
        <label className="block space-y-1 sm:col-span-2"><span className="label-caps">Street address</span><input className={inp} value={location} maxLength={200} onChange={e => setLocation(e.target.value)} data-testid="input-review-location" /></label>
        <label className="block space-y-1"><span className="label-caps">City</span><input className={inp} value={locationCity} maxLength={80} onChange={e => setLocationCity(e.target.value)} data-testid="input-review-city" /></label>
        <label className="block space-y-1"><span className="label-caps">State</span><input className={inp} value={locationState} maxLength={2} onChange={e => setLocationState(e.target.value.toUpperCase())} data-testid="input-review-state" /></label>
        <label className="block space-y-1"><span className="label-caps">ZIP code</span><input className={inp} value={locationZip} maxLength={10} onChange={e => setLocationZip(e.target.value)} data-testid="input-review-zip" /></label>
        <label className="block space-y-1"><span className="label-caps">Zone</span><input className={inp} value={zone} maxLength={40} onChange={e => setZone(e.target.value)} data-testid="input-review-zone" /></label>
        <label className="block space-y-1"><span className="label-caps">Cruiser district</span><input className={inp} value={cruiserDistrict} maxLength={40} onChange={e => setCruiserDistrict(e.target.value)} data-testid="input-review-cruiser-district" /></label>
        <label className="block space-y-1"><span className="label-caps">Incident date / event time</span><input className={inp + ' mono'} value={occurred} placeholder="MM/DD/YYYY HH:MM" onChange={e => setOccurred(e.target.value)} onKeyDown={event=>applyCurrentDateTimeShortcut(event,'datetime',setOccurred)} data-testid="input-review-occurred" /></label>
        <label className="block space-y-1"><span className="label-caps">Dispatched 10-code · enter code only</span><input className={inp + ' mono uppercase'} value={code} placeholder="17 or 17A" onChange={e => updateDispatchedCode(e.target.value)} onBlur={askStopRisk} onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();if(askStopRisk())return;if(!kind){setFailure('This code is ambiguous. Select the correct primary form before continuing.');return;}submitReviewedRun(true);} }} list="new-run-radio-code-list" data-testid="input-review-code" /><span className="text-xs text-muted-foreground">{code?`10-${code} · ${code==='6'?'requires a form choice':(RADIO_CODES[code]??'unlisted code; confirm against the approved code table')}`:'Enter the dispatched code without the 10- prefix.'} Press Enter to open the selected form; Tab moves to the next field.</span></label>
        <label className="block space-y-1"><span className="label-caps">Situation found 10-code · optional{fromCad(situationFoundCode, cadCodes.situationFoundCode) && <CadTag />}</span><input className={inp + ' mono uppercase'} value={situationFoundCode} placeholder="Leave blank if not applicable" onChange={e => setSituationFoundCode(normalizeSituationFoundCode(e.target.value))} list="new-run-radio-code-list" data-testid="input-review-situation-found-code" /></label>
        <datalist id="new-run-radio-code-list">{Object.entries(RADIO_CODES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</datalist>
        <label className="block space-y-1"><span className="label-caps">Dispatched at</span><input className={inp + ' mono'} value={dispatchedAt} placeholder="MM/DD/YYYY HH:MM" onChange={e => setDispatchedAt(e.target.value)} onKeyDown={event=>applyCurrentDateTimeShortcut(event,'datetime',setDispatchedAt)} data-testid="input-review-dispatched-at" /></label>
        <label className="block space-y-1"><span className="label-caps">Cleared at</span><input className={inp + ' mono'} value={clearedAt} placeholder="MM/DD/YYYY HH:MM" onChange={e => setClearedAt(e.target.value)} onKeyDown={event=>applyCurrentDateTimeShortcut(event,'datetime',setClearedAt)} data-testid="input-review-cleared-at" /></label>
        <label className="block space-y-1 sm:col-span-2"><span className="label-caps">Clearance code · optional if dispatch provides it{fromCad(clearanceCode, cadCodes.clearanceCode) && <CadTag />}</span><select className={inp} value={clearanceCode} onChange={e => setClearanceCode(e.target.value as NewRunSeed['clearanceCode'])} data-testid="select-review-clearance-code"><option value="">Not recorded</option>{CLEARANCE_CODES.map(item=><option key={item.code} value={item.code}>{item.code} · {item.label}</option>)}</select></label>
        <label className="flex items-start gap-2 rounded border bg-muted/30 p-2 text-sm sm:col-span-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} data-testid="checkbox-new-run-reviewed" /><span>I reviewed these details{fromDispatch ? ' returned by dispatch' : ''} and corrected anything that was wrong.</span></label>
      </div>}

      <AlertDialogFooter className="flex-wrap gap-2">
        <AlertDialogCancel data-testid="button-new-run-cancel">Cancel</AlertDialogCancel>
        {phase !== 'review' && <button type="button" onClick={manual} className="inline-flex min-h-10 items-center gap-1.5 rounded border bg-card px-3 text-sm font-semibold" data-testid="button-new-run-manual"><PenLine className="h-4 w-4" />Enter manually</button>}
        {phase === 'choose' && <button type="button" disabled={picked === null} onClick={() => { const c = picked !== null ? candidates[picked] : undefined; if (c) applyMatch(c, !!lookupBaselineRef.current); }} className="min-h-10 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-new-run-use-candidate">Use selected record</button>}
        {phase === 'failed' && <button type="button" disabled={lookupLoading} onClick={() => void runLookup()} className="inline-flex min-h-10 items-center gap-1.5 rounded border bg-card px-3 text-sm font-semibold disabled:opacity-50" data-testid="button-new-run-retry"><RotateCw className="h-4 w-4" />{lookupLoading ? 'Retrying…' : 'Retry'}</button>}
        {(phase === 'ask' || phase === 'loading') && <button type="button" disabled={!incident.trim() || !unit.trim() || phase === 'loading'} onClick={() => void runLookup()} className="inline-flex min-h-10 items-center gap-1.5 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-new-run-lookup"><Search className="h-4 w-4" />Look up</button>}
        {phase === 'review' && <button type="button" disabled={!kind || !confirmed} onClick={() => submitReviewedRun()} className="min-h-10 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-new-run-confirm">Open run sheet</button>}
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
    <TrafficStopRiskPrompt open={open&&riskPrompt} onOpenChange={setRiskPrompt} kind={kind} code={code}
      testId="dialog-new-run-high-risk" onChange={next=>{
        setKind(next);setConfirmed(false);setRiskUnanswered(false);setRiskPrompt(false);
        submitReviewedRun(true,next,true);
      }}/>
  </React.Fragment>;
}

function CadTag() {
  return <span className="ml-2 inline-block whitespace-nowrap rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary" data-testid="tag-from-cad">From CAD</span>;
}
