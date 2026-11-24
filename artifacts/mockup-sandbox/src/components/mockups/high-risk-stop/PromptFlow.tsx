import {useEffect,useRef,useState} from 'react';
import {SUBMITTED_PRIMARY_CHECKLISTS} from '../../../../../field-training/src/lib/manual-form-checklists.js';
import './_group.css';

type StopKind='traffic_stop'|'high_risk_stop';

export function PromptFlow(){
  const [code,setCode]=useState('10-6');
  const [promptOpen,setPromptOpen]=useState(true);
  const [kind,setKind]=useState<StopKind|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);

  useEffect(()=>{
    const node=dialog.current;
    if(!node)return;
    if(promptOpen&&!node.open)node.showModal();
    else if(!promptOpen&&node.open)node.close();
  },[promptOpen]);

  function choose(next:StopKind){
    setKind(next);
    setPromptOpen(false);
  }

  return <main className="high-risk-preview">
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center justify-between gap-4 border-b pb-4">
        <h1 className="risk-heading">New Run</h1>
        {kind&&<button type="button" className="border bg-card px-4 py-2 text-sm font-bold"
          onClick={()=>{setKind(null);setCode('10-6');setPromptOpen(false);}}>New Run</button>}
      </header>
      {!kind?<form className="space-y-4 border border-t-4 border-t-primary bg-card p-5"
        onSubmit={event=>{
          event.preventDefault();
          if(/^(?:10[-\s]?)?0?6$/.test(code.trim()))setPromptOpen(true);
        }}>
        <label className="block space-y-2">
          <span className="label-caps">Radio Code</span>
          <input required value={code} onChange={event=>setCode(event.target.value)}
            className="block min-h-11 w-full border bg-card px-3 text-sm"
            aria-label="Radio Code" pattern="(10[- ]?)?0?6"/>
        </label>
        <button type="submit" className="min-h-11 bg-primary px-5 text-sm font-bold text-white">
          Continue
        </button>
      </form>:<section key={kind} className="border border-t-4 border-t-primary bg-card p-5">
        <p className="label-caps">Primary Form · {code}</p>
        <h2 className="risk-heading mt-2">{kind==='high_risk_stop'?'High Risk Traffic Stop':'Traffic Stop'}</h2>
        <div className="mt-5 space-y-5">
          {SUBMITTED_PRIMARY_CHECKLISTS[kind].map((section,index)=><fieldset key={index} className="space-y-2 border-t pt-3">
            <legend className="px-1 text-sm font-bold">{section.title}</legend>
            {section.items.map((item,itemIndex)=><label key={itemIndex} className="flex min-h-10 items-start gap-3 py-2 text-sm">
              <input type="checkbox" className="mt-1" />
              <span>{item.label}</span>
            </label>)}
          </fieldset>)}
        </div>
      </section>}
    </div>
    <dialog ref={dialog} onCancel={()=>setPromptOpen(false)}
      aria-labelledby="stop-risk-prompt-title"
      className="m-auto w-[calc(100%-3rem)] max-w-lg rounded-lg border bg-card p-6 text-foreground shadow-lg backdrop:bg-black/80">
      <p className="label-caps">10-6 · Traffic Stop</p>
      <h2 id="stop-risk-prompt-title" className="risk-heading mt-3">Was This a High-Risk Stop?</h2>
      <div className="mt-7 flex justify-end gap-3">
        <button autoFocus type="button" onClick={()=>choose('traffic_stop')}
          className="min-h-11 min-w-24 border bg-card px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2">
          No
        </button>
        <button type="button" onClick={()=>choose('high_risk_stop')}
          className="min-h-11 min-w-24 bg-primary px-5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2">
          Yes
        </button>
      </div>
    </dialog>
  </main>;
}
