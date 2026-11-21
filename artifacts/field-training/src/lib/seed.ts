import { defaultRatings, emptyDailyActivitySummary, defaultReportingForDutyRecord, type Phase, type Report, type Task } from './model';

const emptyRatings = defaultRatings;
const base = { recruitComments: '', recruitName: 'Sam Example', recruitBadge: '0001', ftoName: 'Officer John Doe', ftoBadge: '0000' };

export function seedReports(): Report[] {
  const narrative = 'FICTIONAL SAMPLE ONLY. Review every prefilled rating against observed performance before marking this log ready.';
  return [
    { id:'s1', date:'2025-01-06', shift:'A-Co', phase:1, zone:'1', precinct:'1', cruiserDistrict:'10', ftoAssignment:'10A', className:'Fictional Sample Class', runs:[], reportingForDuty:defaultReportingForDutyRecord(), ...base, activity:emptyDailyActivitySummary(),
      ratings:emptyRatings(), narrative, remedial:'', status:'draft', signatures:{}, createdAt:'2025-01-06T17:40:00Z', updatedAt:'2025-01-06T17:40:00Z' },
    { id:'s2', date:'2025-01-07', shift:'B-Co', phase:1, zone:'1', precinct:'6', cruiserDistrict:'60', ftoAssignment:'60B', className:'Fictional Sample Class', runs:[], reportingForDuty:defaultReportingForDutyRecord(), ...base, activity:emptyDailyActivitySummary(),
      ratings:emptyRatings(), narrative, remedial:'', status:'draft', signatures:{}, createdAt:'2025-01-07T17:30:00Z', updatedAt:'2025-01-07T17:30:00Z' },
    { id:'s3', date:'2025-01-08', shift:'C-Co', phase:1, zone:'3', precinct:'10', cruiserDistrict:'100', ftoAssignment:'100C', className:'Fictional Sample Class', runs:[], reportingForDuty:defaultReportingForDutyRecord(), ...base, activity:emptyDailyActivitySummary(),
      ratings:emptyRatings(), narrative, remedial:'', status:'draft', signatures:{}, createdAt:'2025-01-08T02:50:00Z', updatedAt:'2025-01-08T02:50:00Z' },
    { id:'s4', date:'2025-01-09', shift:'DMW', phase:2, zone:'6', precinct:'2', cruiserDistrict:'9020', ftoAssignment:'9020D1', className:'Fictional Sample Class', runs:[], reportingForDuty:defaultReportingForDutyRecord(), ...base, activity:emptyDailyActivitySummary(),
      ratings:emptyRatings(), narrative, remedial:'', status:'draft', signatures:{}, createdAt:'2025-01-09T03:10:00Z', updatedAt:'2025-01-09T03:10:00Z' },
    { id:'s5', date:'2025-01-10', shift:'EMW', phase:2, zone:'4', precinct:'3', cruiserDistrict:'9030', ftoAssignment:'9030E1', className:'Fictional Sample Class', runs:[], reportingForDuty:defaultReportingForDutyRecord(), ...base, activity:emptyDailyActivitySummary(),
      ratings:emptyRatings(), narrative, remedial:'', status:'draft', signatures:{}, createdAt:'2025-01-10T05:00:00Z', updatedAt:'2025-01-10T05:00:00Z' },
  ];
}

const T: [Phase, string, string][] = [
  [1,'Orientation','Department sample policy manual acknowledgment'],[1,'Orientation','Patrol vehicle inspection and equipment check'],[1,'Orientation','Radio procedures and sample codes'],[1,'Geography','Precinct and cruiser district familiarization using the official map'],[1,'Geography','Locate 20 sample addresses without assistance'],[1,'Officer Safety','Approach and positioning on pedestrian contacts'],
  [2,'Traffic','Traffic stop positioning and approach'],[2,'Traffic','Collision scene management (simulated)'],[2,'Reports','Incident report structure and timeliness'],[2,'Reports','Evidence handling chain-of-custody basics'],[2,'Calls','Verbal dispute de-escalation'],
  [3,'Calls','Priority call response driving'],[3,'Calls','Building search with cover officer'],[3,'Investigation','Field interview documentation'],[3,'Investigation','Scene preservation and perimeter'],
  [4,'Solo readiness','Independent call handling and phase goals'],[4,'Solo readiness','Final Phase IV review and recommendation'],
];
export function seedTasks(): Task[] {
  return T.map(([phase,group,title],i) => ({ id:'t'+i, phase, group, title, done: phase===1 ? i!==4 : (phase===2 && i===10), ...(phase===1 && i!==4 || (phase===2&&i===10) ? { by:'Officer John Doe (0000)', at:'2025-01-0'+(6+(i%3))+'T18:00:00Z' } : {}) }));
}
