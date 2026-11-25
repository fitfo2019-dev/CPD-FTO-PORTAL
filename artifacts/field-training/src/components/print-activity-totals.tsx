import React from 'react';
import { DAILY_ACTIVITY_COLUMNS, DAILY_ACTIVITY_FIELDS, type DailyActivitySummary } from '@/lib/model.js';

/** Fixed activity groups and real totals, shared by daily and summary forms. */
export function PrintActivityTotals({totals,blocks=2,countLabel='Total'}:{
  totals:DailyActivitySummary;blocks?:1|2|4;countLabel?:string;
}) {
  const fields=new Map(DAILY_ACTIVITY_FIELDS.map(field=>[field.key,field]));
  const perBlock=Math.ceil(DAILY_ACTIVITY_COLUMNS.length/blocks);
  return <div className="print-activity-totals" style={{gridTemplateColumns:`repeat(${blocks},minmax(0,1fr))`}}>
    {Array.from({length:blocks},(_,index)=><table key={index} className="print-activity-table print-activity-totals-table">
      <colgroup><col style={{width:'80%'}}/><col style={{width:'20%'}}/></colgroup>
      <thead>{blocks===4&&<tr><th colSpan={2}>{DAILY_ACTIVITY_COLUMNS[index].title}</th></tr>}<tr><th scope="col">Activity</th><th scope="col">{countLabel}</th></tr></thead>
      {DAILY_ACTIVITY_COLUMNS.slice(index*perBlock,(index+1)*perBlock).map(column=><tbody key={column.title}>
        {blocks!==4&&<tr><th scope="rowgroup" colSpan={2}>{column.title}</th></tr>}
        {column.keys.map(key=>{
          const field=fields.get(key);
          if(!field)throw new Error(`Unknown printed activity: ${key}`);
          return <tr key={key} data-print-activity={key}><td>{field.label}</td><td className="print-activity-count">{totals[key]}</td></tr>;
        })}
      </tbody>)}
    </table>)}
  </div>;
}
