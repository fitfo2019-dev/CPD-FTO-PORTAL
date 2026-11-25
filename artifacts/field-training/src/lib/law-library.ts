export interface LawLibraryEntry {
  id: string;
  kind: 'Ohio Revised Code' | 'Columbus City Code' | 'Case law';
  citation: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  keywords: string[];
  jurisdiction?: string;
  category?: 'Criminal' | 'Traffic' | 'Parking' | 'Sentencing';
}

const ORC_SOURCE = 'Ohio Laws · official statutory text captured November 19, 2026';
const CCC_SOURCE = 'Columbus City Code · chapter index imported from the supplied CSV';
const ORC_CHAPTER_URL = 'https://codes.ohio.gov/ohio-revised-code/chapter-';
const CCC_SOURCE_URL = 'https://library.municode.com/oh/columbus/codes/code_of_ordinances';

type ChapterIndexRow = {
  chapter: string;
  title: string;
  jurisdiction: string;
  category: 'Criminal' | 'Traffic' | 'Parking' | 'Sentencing';
};

const ORC_CHAPTER_INDEX: ChapterIndexRow[] = [
  { chapter: '2901', title: 'General Provisions', jurisdiction: 'State', category: 'Criminal' },
  { chapter: '2903', title: 'Homicide and Assault', jurisdiction: 'State', category: 'Criminal' },
  { chapter: '2905', title: 'Kidnapping and Extortion', jurisdiction: 'State', category: 'Criminal' },
  { chapter: '2907', title: 'Sex Offenses', jurisdiction: 'State', category: 'Criminal' },
  { chapter: '2909', title: 'Arson and Related Offenses', jurisdiction: 'State', category: 'Criminal' },
  { chapter: '2911', title: 'Robbery, Burglary, Trespass, and Safecracking', jurisdiction: 'State', category: 'Criminal' },
  { chapter: '2913', title: 'Theft and Fraud', jurisdiction: 'State', category: 'Criminal' },
  { chapter: '2915', title: 'Gambling', jurisdiction: 'State', category: 'Criminal' },
  { chapter: '2917', title: 'Offenses Against the Public Peace', jurisdiction: 'State', category: 'Criminal' },
  { chapter: '2919', title: 'Offenses Against the Family', jurisdiction: 'State', category: 'Criminal' },
  { chapter: '2921', title: 'Offenses Against Justice and Public Administration', jurisdiction: 'State', category: 'Criminal' },
  { chapter: '2923', title: 'Conspiracy, Attempt, and Complicity; Weapons Control; Corrupt Activity', jurisdiction: 'State', category: 'Criminal' },
  { chapter: '2925', title: 'Drug Offenses', jurisdiction: 'State', category: 'Criminal' },
  { chapter: '2927', title: 'Miscellaneous Offenses', jurisdiction: 'State', category: 'Criminal' },
  { chapter: '2929', title: 'Penalties and Sentencing', jurisdiction: 'State', category: 'Sentencing' },
  { chapter: '4501', title: 'Motor Vehicles - Definitions; General Provisions', jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4503', title: 'Licensing Of Motor Vehicles', jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4504', title: 'Local Motor Vehicle License Tax', jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4505', title: 'Certificate Of Motor Vehicle Title Law', jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4506', title: "Commercial Driver's Licensing", jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4507', title: "Driver's License Law", jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4508', title: 'Driver Training Schools', jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4509', title: 'Financial Responsibility', jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4510', title: "Driver's License Suspension, Cancellation, Revocation", jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4511', title: 'Traffic Laws - Operation Of Motor Vehicles', jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4513', title: 'Traffic Laws - Equipment; Loads', jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4515', title: 'Venue; Guest Statute', jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4516', title: 'Peer-To-Peer Car Sharing Programs', jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4517', title: 'Motor Vehicle Dealers, Auction Owners, and Salespersons', jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4519', title: 'Special Vehicles', jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4521', title: 'Local, Noncriminal Parking Infractions', jurisdiction: 'State', category: 'Parking' },
  { chapter: '4549', title: 'Motor Vehicle Crimes', jurisdiction: 'State', category: 'Traffic' },
  { chapter: '4551', title: 'Transportation Of Christmas Trees', jurisdiction: 'State', category: 'Traffic' },
];

const CCC_CHAPTER_INDEX: ChapterIndexRow[] = [
  { chapter: '2101', title: 'Traffic Code Definitions', jurisdiction: 'Local (Columbus)', category: 'Traffic' },
  { chapter: '2111', title: 'Traffic Control Devices', jurisdiction: 'Local (Columbus)', category: 'Traffic' },
  { chapter: '2131', title: 'Operation Generally (Speeding, Signals, Pedestrians)', jurisdiction: 'Local (Columbus)', category: 'Traffic' },
  { chapter: '2133', title: 'Intoxication; Reckless Operation; Speed (Local OVI / DUI)', jurisdiction: 'Local (Columbus)', category: 'Traffic' },
  { chapter: '2135', title: 'Licensing; Plates; Registration', jurisdiction: 'Local (Columbus)', category: 'Traffic' },
  { chapter: '2151', title: 'Parking Infractions & Impoundment Rules', jurisdiction: 'Local (Columbus)', category: 'Traffic' },
  { chapter: '2301', title: 'General Offenses Definitions & Culpability', jurisdiction: 'Local (Columbus)', category: 'Criminal' },
  { chapter: '2303', title: 'Homicide, Assault, and Threats', jurisdiction: 'Local (Columbus)', category: 'Criminal' },
  { chapter: '2305', title: 'Kidnapping and Extortion', jurisdiction: 'Local (Columbus)', category: 'Criminal' },
  { chapter: '2307', title: 'Sex Offenses', jurisdiction: 'Local (Columbus)', category: 'Criminal' },
  { chapter: '2309', title: 'Arson and Property Damage', jurisdiction: 'Local (Columbus)', category: 'Criminal' },
  { chapter: '2311', title: 'Robbery, Burglary, and Trespass', jurisdiction: 'Local (Columbus)', category: 'Criminal' },
  { chapter: '2313', title: 'Theft and Fraud', jurisdiction: 'Local (Columbus)', category: 'Criminal' },
  { chapter: '2317', title: 'Offenses Against Public Peace (Disorderly Conduct, Riot)', jurisdiction: 'Local (Columbus)', category: 'Criminal' },
  { chapter: '2321', title: 'Offenses Against Justice and Administration', jurisdiction: 'Local (Columbus)', category: 'Criminal' },
  { chapter: '2323', title: 'Weapons Control', jurisdiction: 'Local (Columbus)', category: 'Criminal' },
  { chapter: '2325', title: 'Liquor Control & Underage Offenses', jurisdiction: 'Local (Columbus)', category: 'Criminal' },
  { chapter: '2331', title: 'Discriminatory Practices & Ethnic Intimidation', jurisdiction: 'Local (Columbus)', category: 'Criminal' },
];

function chapterEntry(kind: 'Ohio Revised Code' | 'Columbus City Code', row: ChapterIndexRow): LawLibraryEntry {
  const prefix = kind === 'Ohio Revised Code' ? 'ORC' : 'CCC';
  const source = kind === 'Ohio Revised Code' ? ORC_SOURCE : CCC_SOURCE;
  const titleSearchWords = row.title.split(/[^a-z0-9]+/i).filter(Boolean);
  const chapterCitation = `${prefix} Chapter ${row.chapter}`;
  const sourceInstructions = kind === 'Ohio Revised Code'
    ? 'Browse the locally searchable section text, or open the official Ohio Laws chapter page to check for updates.'
    : `Open the official Columbus code reader and search for Chapter ${row.chapter} to view its current sections.`;
  const summary = kind === 'Ohio Revised Code'
    ? `${row.jurisdiction} · ${row.category}. The portal includes searchable sections from this chapter. ${sourceInstructions}`
    : `${row.jurisdiction} · ${row.category}. This chapter title and category are from the supplied CSV index; this entry is not the ordinance text. ${sourceInstructions}`;
  return {
    id: `${prefix.toLowerCase()}-chapter-${row.chapter}`,
    kind,
    citation: chapterCitation,
    title: row.title,
    summary,
    source,
    url: kind === 'Ohio Revised Code' ? `${ORC_CHAPTER_URL}${row.chapter}` : CCC_SOURCE_URL,
    keywords: [prefix, row.chapter, row.category, row.jurisdiction, ...titleSearchWords],
    jurisdiction: row.jurisdiction,
    category: row.category,
  };
}

// The supplied CSV is a chapter index, not the complete text of either code.
// Keep each jurisdiction separate and link users to its official live source.
export const OHIO_REVISED_CODE_ENTRIES: LawLibraryEntry[] = [
  ...ORC_CHAPTER_INDEX.map((row) => chapterEntry('Ohio Revised Code', row)),
];

export const COLUMBUS_CITY_CODE_ENTRIES: LawLibraryEntry[] = [
  ...CCC_CHAPTER_INDEX.map((row) => chapterEntry('Columbus City Code', row)),
  {
    id: 'ccc-2303-13',
    kind: 'Columbus City Code',
    citation: 'CCC 2303.13',
    title: 'Assault',
    summary: 'Official section text is available from the Columbus City Code source.',
    source: 'Columbus Code of Ordinances · official source reader',
    url: `${CCC_SOURCE_URL}?nodeId=TIT23GEOFCO_CH2303OFINPE_2303.13AS`,
    keywords: ['assault', 'physical harm', 'school', 'city property', 'firearm'],
    category: 'Criminal',
  },
];

export const CASE_LAW_ENTRIES: LawLibraryEntry[] = [
  {
    id: 'case-terry-v-ohio',
    kind: 'Case law',
    citation: 'Terry v. Ohio, 392 U.S. 1 (1968)',
    title: 'Investigative stop and limited frisk',
    summary: 'A brief investigative stop may rest on reasonable suspicion. A protective frisk is narrower: the officer must reasonably suspect the person is armed and dangerous, and the search is limited to its safety purpose.',
    source: 'U.S. Supreme Court · case summary and opinion',
    url: 'https://www.oyez.org/cases/1967/67',
    keywords: ['reasonable suspicion', 'stop', 'frisk', 'pat down', 'armed', 'dangerous', 'search'],
  },
  {
    id: 'case-mapp-v-ohio',
    kind: 'Case law',
    citation: 'Mapp v. Ohio, 367 U.S. 643 (1961)',
    title: 'Exclusionary rule',
    summary: 'The Supreme Court held that the Fourth Amendment exclusionary rule applies in state courts. Evidence obtained through an unconstitutional search may be excluded.',
    source: 'U.S. Supreme Court · case summary and opinion',
    url: 'https://www.oyez.org/cases/1960/236',
    keywords: ['search', 'seizure', 'exclusionary rule', 'evidence', 'fourth amendment'],
  },
  {
    id: 'case-ohio-v-robinette',
    kind: 'Case law',
    citation: 'Ohio v. Robinette, 519 U.S. 33 (1996)',
    title: 'Consent after a traffic stop',
    summary: 'The federal Constitution does not require a fixed “free to go” warning before an officer asks for consent after a traffic stop. Voluntariness depends on the circumstances; follow current law and Division directives.',
    source: 'U.S. Supreme Court · case summary and opinion',
    url: 'https://www.oyez.org/cases/1996/95-891',
    keywords: ['traffic stop', 'consent', 'search', 'free to go', 'voluntary'],
  },
];

export const LAW_LIBRARY_ENTRIES: LawLibraryEntry[] = [
  ...OHIO_REVISED_CODE_ENTRIES,
  ...COLUMBUS_CITY_CODE_ENTRIES,
  ...CASE_LAW_ENTRIES,
];

export const LAW_LIBRARY_SOURCES = [
  { label: 'Ohio Revised Code', url: 'https://codes.ohio.gov/ohio-revised-code' },
  { label: 'Columbus City Code', url: 'https://library.municode.com/oh/columbus/codes/code_of_ordinances' },
  { label: 'Ohio Public Defender Criminal Law Casebook', url: 'https://opd.ohio.gov/law-library/criminal-law-casebook/criminal-law-casebook' },
  { label: 'Ohio Public Defender Legal Glossary', url: 'https://opd.ohio.gov/law-library/glossary-of-legal-terms' },
  { label: 'Oyez Supreme Court cases', url: 'https://www.oyez.org/' },
];
