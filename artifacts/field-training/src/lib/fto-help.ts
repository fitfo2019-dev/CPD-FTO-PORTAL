export const DIRECTIVES_INDEX = 'https://www.columbus.gov/Services/Public-Safety/Police/About-the-Columbus-Division-of-Police/Directives';
export const MANUAL_SOURCE = 'Uploaded Final FTO Manual · updated 03/10/2026';

// Operational explanations are paraphrases of the supplied manual/forms.
// App controls, security notices and user-specified overrides are not policy sources.
export const FTO_HELP = [
  { id:'daily', title:'Daily Performance Log · U-10.174', source:'FTO Manual · daily rating and activity instructions; current form number per FTO direction', text:'Completed for each tour of duty during each phase. Records the PO’s performance ratings and daily activity. Performance ratings are not recorded on Limbo days.' },
  { id:'daily-packet', title:'Daily Performance Packet', source:'FTO Manual · Glossary: Daily Performance Packet', text:'Contains the Daily Performance Log, completed FTO checklist forms, and copies of additional reports or paperwork the FTO attaches.' },
  { id:'run', title:'Run checklist forms', source:'FTO Manual · Glossary: Checklist FTO forms', text:'Evaluate performance on each dispatched or self-initiated run. The checklists address training, policies, patrol tasks, and officer safety. They may also be used for review or debriefing and belong with the daily packet.' },
  { id:'activity', title:'Daily and Weekly Activity Summary', source:'FTO Manual · Glossary: Activity Summary', text:'A tally of common patrol tasks, located at the bottom of the daily and weekly summaries.' },
  { id:'weekly', title:'Weekly Performance Summary · U-10.173', source:'FTO Manual · Glossary: Weekly Performance Summary; current form number per FTO direction', text:'Displays the total number of ratings received in each performance category for the week and totals the activity summary.' },
  { id:'weekly-log', title:'Weekly Performance Log Supplement · U-10.174S', source:'Uploaded Weekly Performance Log · pages 1 and continuation; current supplement number per FTO direction', text:'Documents PO strengths by category, deficient performance, weekly corrective training, and total training time. The continuation page provides additional space.' },
  { id:'weekly-packet', title:'Weekly Evaluation Packet', source:'FTO Manual · Glossary: Weekly Evaluation Summary/Packet', text:'Contains the Weekly Performance Summary, Weekly Performance Log Supplement, a Daily Performance Log for each day, Weekly Comment/Signature Form, completed checklists, and additional supplements or copies of paperwork.' },
  { id:'ack', title:'Weekly Packet Acknowledgement', source:'FTO Manual · Glossary: Weekly Comment/Signature Form; uploaded Weekly Comment and Signature form', text:'Includes the PO’s, FTO’s, and Field Training Office’s comments and signatures. It reflects weekly performance and acknowledges review of the packet.' },
  { id:'orientation', title:'Substation Orientation', source:'Uploaded Substation Orientation · U-10.181, page 1', text:'Complete on the first day only. Covers the substation, inspectional items, cruiser, communications, and precinct orientation.' },
  { id:'duty', title:'Reporting for Duty', source:'Uploaded Reporting for Duty · U-10.191, page 1', text:'Covers appearance and equipment, roll call and cruiser inspection, marking out of service, and shotgun training.' },
  { id:'narrative', title:'Run narrative and corrective training', source:'Uploaded Call for Service · U-10.182, page 1; FTO Manual · Glossary: Corrective Training', text:'Document performance or lack of performance requiring FTO assistance and corrective training or retraining, plus pertinent information not addressed by the checklist. Other information the FTO considers necessary may also be included.' },
  { id:'narrative-addition', title:'Narrative Addition / Continuation', source:'FTO Manual · U-10.192 Narrative Addition form', text:'Use the separate Narrative Addition form when the run narrative needs additional pages. The portal prints a numbered continuation page for each chunk and keeps the narrative text without a character limit.' },
  { id:'no', title:'NO · Not Observed', source:'FTO Manual · Glossary: Not Observed', text:'The PO did not have the opportunity to perform the job function or patrol task.' },
  { id:'a', title:'A · Acceptable', source:'FTO Manual · Glossary: Acceptable', text:'The PO performs the job function, patrol task, or paperwork in a timely manner without FTO assistance or direction.' },
  { id:'rt', title:'RT · Responding to Training', source:'FTO Manual · Glossary: Responding to Training', text:'The PO reasonably performs the job function, patrol task, or paperwork but requires minimal FTO direction or assistance. The task may or may not be completed in a timely manner.' },
  { id:'ua', title:'UA · Unacceptable', source:'FTO Manual · Glossary: Unacceptable', text:'The PO displays poor or deficient performance, requires frequent FTO direction or assistance, or does not complete the task or paperwork in a timely manner.' },
  { id:'nrt', title:'NRT · Not Responding to Training', source:'FTO Manual · Glossary: Not Responding to Training', text:'A pattern of documented poor or deficient performance continues despite corrective retraining. Supporting documentation of the corrective training and response is required.' },
] as const;

export const UPLOADED_FORM_SOURCES = [
  { title:'Arrest Process', pages:3, fields:69, scope:'Conditional arrest supplement' },
  { title:'Building Search', pages:2, fields:84, scope:'Primary run checklist' },
  { title:'Call for Service', pages:2, fields:65, scope:'Primary run checklist' },
  { title:'Domestic Incident', pages:2, fields:76, scope:'Primary run checklist' },
  { title:'High Risk Traffic Stop', pages:2, fields:70, scope:'Primary run checklist' },
  { title:'OVI Process', pages:2, fields:70, scope:'Conditional OVI supplement' },
  { title:'Reporting for Duty', pages:2, fields:44, scope:'Daily duty checklist' },
  { title:'Self-Initiated Run / Training', pages:2, fields:65, scope:'Primary run checklist' },
  { title:'Substation Orientation', pages:2, fields:91, scope:'First day only' },
  { title:'Traffic Crash Investigation', pages:2, fields:65, scope:'Primary run checklist' },
  { title:'Traffic Stop', pages:2, fields:78, scope:'Primary run checklist' },
  { title:'Weekly Comment and Signature', pages:1, fields:16, scope:'Weekly packet acknowledgement' },
  { title:'Weekly Performance Log · page 1', pages:1, fields:65, scope:'Weekly strengths and corrective training' },
  { title:'Weekly Performance Log · continuation', pages:1, fields:72, scope:'Weekly narrative continuation' },
] as const;
