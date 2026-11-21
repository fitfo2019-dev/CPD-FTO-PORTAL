/** Split without discarding characters; print layout assigns one continuation page per chunk. */
export function needsRunNarrativeContinuation(value:string,explicitlyRequired=false):boolean {
  return explicitlyRequired||value.length>220||value.split('\n').length>3;
}

export function splitNarrativeContinuation(value:string) {
  if(!value)return [''];
  const chunks:string[]=[];
  let start=0;
  while(start<value.length){
    let end=Math.min(start+2800,value.length);
    if(end<value.length){
      const newline=value.lastIndexOf('\n',end);
      const space=value.lastIndexOf(' ',end);
      const boundary=Math.max(newline,space);
      if(boundary>start+1400)end=boundary+1;
    }
    chunks.push(value.slice(start,end));
    start=end;
  }
  return chunks;
}

/** Keep spreadsheet-sized daily notes short without dropping any narrative text. */
export function dailyLogContinuations(report:{narrative:string;remedial:string}) {
  const charactersPerLine=35;
  const linesPerPage=35;
  return [
    {label:'FTO comments / shift narrative',value:report.narrative},
    {label:'Corrective training / retraining',value:report.remedial},
  ].flatMap(note=>{
    if(note.value.length<=120&&note.value.split('\n').length<=2)return [];
    const parts:string[]=[];
    let part='',lines=0;
    // Preserve every character, while bounding both wrapped lines and explicit newlines.
    for(const line of note.value.match(/[^\n]*\n|[^\n]+$/g)??[]){
      const characters=Array.from(line);
      for(let start=0;start<characters.length;start+=charactersPerLine){
        const segment=characters.slice(start,start+charactersPerLine).join('');
        if(lines>=linesPerPage){parts.push(part);part='';lines=0;}
        part+=segment;lines++;
      }
    }
    if(part)parts.push(part);
    return parts.map((text,index)=>({label:note.label,text,part:index+1,total:parts.length}));
  });
}
