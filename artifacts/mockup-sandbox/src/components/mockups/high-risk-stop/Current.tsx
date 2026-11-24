import {useId,useState} from 'react';
import './_group.css';

type StopKind='traffic_stop'|'high_risk_stop';
// Extracted from the current app component. No records, API or vault access.
function TrafficStopRiskChoice({kind,onChange,testId}:{
  kind:StopKind;onChange:(kind:StopKind)=>void;testId:string;
}){
  const name=useId();
  return <fieldset className="space-y-1 sm:col-span-2" data-testid={testId}>
    <legend className="label-caps">High risk?</legend>
    <div className="flex gap-4">
      {([{value:'traffic_stop',label:'N · No'},{value:'high_risk_stop',label:'Y · Yes'}] as const).map(option=>
        <label key={option.value} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
          <input type="radio" name={name} value={option.value} checked={kind===option.value} onChange={()=>onChange(option.value)}/>
          {option.label}
        </label>)}
    </div>
  </fieldset>;
}
export function Current(){
  const [newKind,setNewKind]=useState<StopKind>('traffic_stop');
  const [detailKind,setDetailKind]=useState<StopKind>('high_risk_stop');
  return <main className="high-risk-preview">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="border-b pb-4">
        <p className="label-caps">Field Training Officer Portal · Control preview</p>
        <h1 className="risk-heading mt-2">Traffic Stop — High risk?</h1>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        {([{title:'New-run entry',kind:newKind,change:setNewKind,id:'preview-new-risk'},
          {title:'Run details',kind:detailKind,change:setDetailKind,id:'preview-detail-risk'}]).map(panel=>
          <section key={panel.id} className="border border-t-4 border-t-primary bg-card p-5">
            <h2 className="mb-5 text-base font-bold">{panel.title}</h2>
            <TrafficStopRiskChoice kind={panel.kind} onChange={panel.change} testId={panel.id}/>
            <div className="mt-5 border-t pt-4">
              <p className="label-caps">Selected primary form</p>
              <p className="mt-2 text-sm font-semibold" aria-live="polite">{panel.kind==='traffic_stop'?'Traffic Stop':'High Risk Traffic Stop'}</p>
            </div>
          </section>)}
      </div>
    </div>
  </main>;
}
