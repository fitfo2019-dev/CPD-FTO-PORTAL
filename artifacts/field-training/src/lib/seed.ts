import { CATEGORIES, type Category, type Rating, type Report, type Task, type Workspace } from './model';

const R = (a: Rating[], j: Partial<Record<Category,string>> = {}) => Object.fromEntries(CATEGORIES.map((c,i)=>[c,{ rating: a[i], justification: j[c] ?? '' }])) as Report['ratings'];
const base = { precinct: 'Sample Precinct North', recruitComments: '', recruitName: 'Recruit Sam Example', recruitBadge: '0001', ftoName: 'Officer John Doe', ftoBadge: '0000', sergeantName: 'Sgt. Jane Sample' };
const sig = (name: string, badge: string, at: string) => ({ name, badge, at });

export function seedReports(): Report[] {
  return [
    { id:'s1', number:'DOR-0001', date:'2025-01-06', shift:'Day', phase:1, ...base, beat:'Sample Beat 1', hours:10, calls:7,
      ratings: R(['A','A','RT','RT','A']), narrative:'FICTIONAL SAMPLE. Recruit completed first full shift. Radio traffic hesitant but accurate. Vehicle inspection performed without prompting.', remedial:'Review radio codes card before next shift.',
      status:'locked', signatures:{ fto:sig('Officer John Doe','0000','2025-01-06T18:12:00Z'), recruit:sig('Recruit Sam Example','0001','2025-01-06T18:20:00Z'), sergeant:sig('Sgt. Jane Sample','9999','2025-01-07T07:05:00Z') }, createdAt:'2025-01-06T17:40:00Z', updatedAt:'2025-01-07T07:05:00Z' },
    { id:'s2', number:'DOR-0002', date:'2025-01-07', shift:'Day', phase:1, ...base, beat:'Sample Beat 1', hours:10, calls:9,
      ratings: R(['A','A','UA','RT','A'], { knowledge:'FICTIONAL SAMPLE. Could not locate three sample addresses without map assistance; reviewed street grid during lunch break.' }), narrative:'FICTIONAL SAMPLE. Improved radio cadence. Geography remains the primary gap.', remedial:'Map drill: 20 sample addresses on the training grid.',
      status:'locked', signatures:{ fto:sig('Officer John Doe','0000','2025-01-07T18:02:00Z'), recruit:sig('Recruit Sam Example','0001','2025-01-07T18:10:00Z'), sergeant:sig('Sgt. Jane Sample','9999','2025-01-08T07:01:00Z') }, createdAt:'2025-01-07T17:30:00Z', updatedAt:'2025-01-08T07:01:00Z' },
    { id:'s3', number:'DOR-0003', date:'2025-01-08', shift:'Swing', phase:1, ...base, beat:'Sample Beat 2', hours:10, calls:11,
      ratings: R(['A','A','A','A','A'], { relationships:'FICTIONAL SAMPLE. De-escalated a loud verbal dispute between two neighbors using calm tone and active listening; both parties thanked the recruit.' }), narrative:'FICTIONAL SAMPLE. Strong community contact skills. Report writing timely.', remedial:'', recruitComments:'FICTIONAL SAMPLE. Agree with evaluation; will keep practicing active listening.',
      status:'recruit_signed', signatures:{ fto:sig('Officer John Doe','0000','2025-01-08T03:15:00Z'), recruit:sig('Recruit Sam Example','0001','2025-01-08T03:22:00Z') }, createdAt:'2025-01-08T02:50:00Z', updatedAt:'2025-01-08T03:22:00Z' },
    { id:'s4', number:'DOR-0004', date:'2025-01-09', shift:'Swing', phase:2, ...base, beat:'Sample Beat 2', hours:10, calls:8,
      ratings: R(['A','A','A','NRT','NO'], { performance:'FICTIONAL SAMPLE. Third shift in a row approaching sample vehicle without positioning patrol unit offset despite prior corrections.' }), narrative:'FICTIONAL SAMPLE. Officer safety positioning on traffic stops remains below standard after repeated coaching.', remedial:'Two hours of traffic-stop positioning scenarios with FTO.',
      status:'fto_signed', signatures:{ fto:sig('Officer John Doe','0000','2025-01-09T03:40:00Z') }, createdAt:'2025-01-09T03:10:00Z', updatedAt:'2025-01-09T03:40:00Z' },
    { id:'s5', number:'DOR-0005', date:'2025-01-10', shift:'Night', phase:2, ...base, beat:'Sample Beat 3', hours:6, calls:4,
      ratings: R(['A','A','RT','','']), narrative:'FICTIONAL SAMPLE. In progress — documenting between calls.', remedial:'',
      status:'draft', signatures:{}, createdAt:'2025-01-10T05:00:00Z', updatedAt:'2025-01-10T05:00:00Z' },
  ];
}

const T: [1|2|3|4|5, string, string][] = [
  [1,'Orientation','Department sample policy manual acknowledgment'],[1,'Orientation','Patrol vehicle inspection and equipment check'],[1,'Orientation','Radio procedures and sample codes'],[1,'Geography','Beat boundaries on training grid'],[1,'Geography','Locate 20 sample addresses without assistance'],[1,'Officer Safety','Approach and positioning on pedestrian contacts'],
  [2,'Traffic','Traffic stop positioning and approach'],[2,'Traffic','Collision scene management (simulated)'],[2,'Reports','Incident report structure and timeliness'],[2,'Reports','Evidence handling chain-of-custody basics'],[2,'Calls','Verbal dispute de-escalation'],
  [3,'Calls','Priority call response driving'],[3,'Calls','Building search with cover officer'],[3,'Investigation','Field interview documentation'],[3,'Investigation','Scene preservation and perimeter'],
  [4,'Solo readiness','Plain-clothes FTO evaluation shift'],[4,'Solo readiness','Independent call handling, full shift'],[4,'Solo readiness','Final phase review with sergeant'],
  [5,'Shadow phase','FTO observes in plain clothes, no intervention'],[5,'Shadow phase','Recruit leads all calls for full shift'],[5,'Shadow phase','Shadow phase sign-off with sergeant'],
];
export function seedTasks(): Task[] {
  return T.map(([phase,group,title],i) => ({ id:'t'+i, phase, group, title, done: phase===1 ? i!==4 : (phase===2 && i===10), ...(phase===1 && i!==4 || (phase===2&&i===10) ? { by:'Officer John Doe (0000)', at:'2025-01-0'+(6+(i%3))+'T18:00:00Z' } : {}) }));
}
export function seedWorkspace(): Workspace { return { version: 0, role: 'fto', reports: seedReports(), tasks: seedTasks() }; }
