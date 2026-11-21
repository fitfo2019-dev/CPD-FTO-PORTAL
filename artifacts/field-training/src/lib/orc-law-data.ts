export type OrcLawCategory = 'Criminal' | 'Traffic' | 'Parking' | 'Sentencing';

export type OfficialOrcSection = {
  id: string;
  citation: string;
  section: string;
  chapter: string;
  chapterTitle: string;
  title: string;
  category: OrcLawCategory;
  effectiveDate: string;
  latestLegislation: string;
  sourceUrl: string;
  text: string;
  retrievedAt: string;
};

export type OrcCorpusManifest = {
  source: string;
  sourceUrl: string;
  retrievedOn: string;
  scope: {
    criminalChapters: number[];
    motorVehicleTrafficAndParkingChapters: number[];
  };
  sectionCount: number;
  files: string[];
  textPolicy: string;
};

const OFFICIAL_SECTION_URL = /^https:\/\/codes\.ohio\.gov\/ohio-revised-code\/section-\d+\.\d+$/;
const CORPUS_FILE = /^orc-(?:criminal|traffic)-[\d-]+\.json$/;
const CATEGORIES = new Set<OrcLawCategory>(['Criminal', 'Traffic', 'Parking', 'Sentencing']);

export function validateOrcCorpusData(
  manifest: OrcCorpusManifest,
  chunks: OfficialOrcSection[][],
): OfficialOrcSection[] {
  if (manifest.sourceUrl !== 'https://codes.ohio.gov/ohio-revised-code') {
    throw new Error('The Ohio Revised Code manifest has an unexpected source.');
  }
  if (!manifest.files.length || manifest.files.some((file) => !CORPUS_FILE.test(file))) {
    throw new Error('The Ohio Revised Code manifest contains an invalid data file list.');
  }

  const sections = chunks.flat();
  if (sections.length !== manifest.sectionCount) {
    throw new Error(`Expected ${manifest.sectionCount} ORC sections but loaded ${sections.length}.`);
  }

  const ids = new Set<string>();
  for (const section of sections) {
    if (!section.id || ids.has(section.id)) {
      throw new Error(`Duplicate or missing ORC section ID: ${section.id || '(blank)'}.`);
    }
    ids.add(section.id);
    if (
      !section.section
      || !section.chapter
      || !section.chapterTitle
      || !section.title
      || !section.text
      || !OFFICIAL_SECTION_URL.test(section.sourceUrl)
      || !CATEGORIES.has(section.category)
      || section.retrievedAt !== manifest.retrievedOn
    ) {
      throw new Error(`ORC section ${section.citation || section.id} is incomplete or has invalid provenance.`);
    }
  }

  return sections.sort((a, b) => a.section.localeCompare(b.section, undefined, { numeric: true }));
}

export async function loadOrcCorpus(basePath: string): Promise<OfficialOrcSection[]> {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const manifestResponse = await fetch(`${base}law-data/orc-corpus-manifest.json`);
  if (!manifestResponse.ok) throw new Error('Could not load the ORC corpus manifest.');
  const manifest = await manifestResponse.json() as OrcCorpusManifest;
  const chunks = await Promise.all(manifest.files.map(async (file) => {
    const response = await fetch(`${base}law-data/${file}`);
    if (!response.ok) throw new Error(`Could not load ORC data file ${file}.`);
    return await response.json() as OfficialOrcSection[];
  }));
  return validateOrcCorpusData(manifest, chunks);
}
