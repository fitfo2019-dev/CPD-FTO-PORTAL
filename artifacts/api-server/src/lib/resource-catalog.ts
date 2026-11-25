import { ListResourcesResponse } from "@workspace/api-zod";

const RESOURCE_FILES = [
  {
    id: "amys-law-factors",
    title: "Amy's Law Factors",
    file_type: "DOC",
    file_name: "Amys_law_factors_1795416886067.doc",
    download_name: "Amys-Law-Factors.doc",
    content_type: "application/msword",
    description: "Reference sheet on Amy's Law bond considerations.",
    handling_note: "",
  },
  {
    id: "bmv-2255-urine-0-bac",
    title: "BMV 2255: Urine and 0 BAC",
    file_type: "DOCX",
    file_name: "BMV_2255_URINE_AND_0_BAC_1795416886067.docx",
    download_name: "BMV-2255-Urine-and-0-BAC.docx",
    content_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    description: "Uploaded BMV 2255 notes and completion guidance.",
    handling_note:
      "Contains a personal name in the example. Handle as restricted training material.",
  },
  {
    id: "bmv2255-example",
    title: "BMV 2255 Example",
    file_type: "PDF",
    file_name: "BMV2255_EXAMPLE_1795416886068.pdf",
    download_name: "BMV-2255-Example.pdf",
    content_type: "application/pdf",
    description: "Uploaded example of the BMV 2255 form.",
    handling_note:
      "Example forms may contain personal details. Review before sharing or printing.",
  },
  {
    id: "domestic-violence-protocol",
    title: "Domestic Violence Protocol",
    file_type: "PDF",
    file_name: "Domestic_Violence_Protocol_1795416886068.pdf",
    download_name: "Domestic-Violence-Protocol.pdf",
    content_type: "application/pdf",
    description: "Ohio model protocol for responding to domestic violence.",
    handling_note:
      "The uploaded edition identifies a 2003 revision. Verify current agency guidance.",
  },
  {
    id: "drug-possession-weights",
    title: "Drug Possession Weights",
    file_type: "PDF",
    file_name: "Drug_Possession_Weights_1795416886068.pdf",
    download_name: "Drug-Possession-Weights.pdf",
    content_type: "application/pdf",
    description: "Uploaded weight reference sheet for drug possession.",
    handling_note: "Verify legal thresholds against current official sources.",
  },
  {
    id: "dv-strangulation-diagram",
    title: "DV Strangulation Diagram",
    file_type: "PDF",
    file_name: "DV_Strangulation_Diagram_1795416886068.pdf",
    download_name: "DV-Strangulation-Diagram.pdf",
    content_type: "application/pdf",
    description: "Uploaded diagram and question prompts for strangulation cases.",
    handling_note:
      "Training reference only. Follow current medical and agency protocols.",
  },
  {
    id: "key-criminal-law-issues-2024",
    title: "Key Criminal Law Issues (2024)",
    file_type: "PDF",
    file_name: "Key_Criminal_Law_Issues_2024_final_1795416886068.pdf",
    download_name: "Key-Criminal-Law-Issues-2024.pdf",
    content_type: "application/pdf",
    description: "Uploaded 2024 criminal law issues reference.",
    handling_note: "Check for updates in current official sources.",
  },
  {
    id: "ohio-constitutional-opinions",
    title: "Ohio Constitutional Opinions",
    file_type: "DOCX",
    file_name: "Ohio_Constitutional_Opinions_1795416886068.docx",
    download_name: "Ohio-Constitutional-Opinions.docx",
    content_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    description: "Uploaded collection of Ohio constitutional case opinions.",
    handling_note: "Check case status and current controlling law.",
  },
  {
    id: "ohio-supreme-court-felony-quick-reference",
    title: "Ohio Supreme Court Felony Quick Reference",
    file_type: "PDF",
    file_name: "Ohio_Supreme_court_felonyQuickRef_1795416886068.pdf",
    download_name: "Ohio-Supreme-Court-Felony-Quick-Reference.pdf",
    content_type: "application/pdf",
    description: "Felony sentencing quick reference uploaded with this request.",
    handling_note: "Verify current statutes and case law before relying on it.",
  },
  {
    id: "police-phone-directory",
    title: "Police Phone Directory",
    file_type: "PDF",
    file_name: "Police_Phone_directory_1795416886068.pdf",
    download_name: "Police-Phone-Directory.pdf",
    content_type: "application/pdf",
    description: "Uploaded police contact directory.",
    handling_note:
      "Contains internal contact information. Use and share under agency policy.",
  },
  {
    id: "prior-offenses-constituting-wud",
    title: "Prior Offenses Constituting WUD",
    file_type: "PDF",
    file_name: "Prior_Offenses_Constituting_WUD_1795416886069.pdf",
    download_name: "Prior-Offenses-Constituting-WUD.pdf",
    content_type: "application/pdf",
    description: "Uploaded reference listing prior offenses related to WUD.",
    handling_note: "Verify current law and agency guidance.",
  },
  {
    id: "dv-3-3-domestic-violence",
    title: "3-3 Domestic Violence",
    file_type: "PDF",
    file_name: "dv-3-3-domestic-violence.pdf",
    download_name: "3-3-Domestic-Violence.pdf",
    content_type: "application/pdf",
    description: "Domestic-violence training reference from the uploaded DV Training archive.",
    handling_note: "Training reference only. Follow current agency policy and protocol.",
  },
  {
    id: "dv-cpo-vs-tpo",
    title: "CPO vs TPO",
    file_type: "PDF",
    file_name: "dv-cpo-vs-tpo.pdf",
    download_name: "CPO-vs-TPO.pdf",
    content_type: "application/pdf",
    description: "Training reference comparing CPO and TPO terminology.",
    handling_note: "Verify legal requirements against current official sources.",
  },
  {
    id: "dv-family-household-member-relationships",
    title: "Family or Household Member Relationships",
    file_type: "PDF",
    file_name: "dv-family-household-member-relationships.pdf",
    download_name: "Family-or-Household-Member-Relationships.pdf",
    content_type: "application/pdf",
    description: "Domestic-violence training reference on family or household relationships.",
    handling_note: "Training reference only. Follow current agency policy and protocol.",
  },
  {
    id: "dv-feti-model",
    title: "FETI Model",
    file_type: "PDF",
    file_name: "dv-feti-model.pdf",
    download_name: "FETI-Model.pdf",
    content_type: "application/pdf",
    description: "Uploaded FETI model training reference.",
    handling_note: "Training reference only. Follow current agency policy and protocol.",
  },
  {
    id: "i-40-115-domestic-violence-lethality-screen",
    title: "I-40.115 Domestic Violence Lethality Screen",
    file_type: "PDF",
    file_name: "i-40-115-domestic-violence-lethality-screen.pdf",
    download_name: "I-40.115-Domestic-Violence-Lethality-Screen.pdf",
    content_type: "application/pdf",
    description: "Uploaded domestic-violence lethality-screen training reference.",
    handling_note: "Verify the approved revision and follow current agency protocol.",
  },
  {
    id: "dv-power-and-control-wheel",
    title: "Power and Control Wheel",
    file_type: "PDF",
    file_name: "dv-power-and-control-wheel.pdf",
    download_name: "Power-and-Control-Wheel.pdf",
    content_type: "application/pdf",
    description: "Uploaded power-and-control training reference.",
    handling_note: "Training reference only. Follow current agency policy and protocol.",
  },
  {
    id: "dv-safety-plan-victims-page-1",
    title: "Safety Plan for Victims, Page 1",
    file_type: "PDF",
    file_name: "dv-safety-plan-victims-page-1.pdf",
    download_name: "Safety-Plan-for-Victims-Page-1.pdf",
    content_type: "application/pdf",
    description: "Victim-safety planning reference, page 1.",
    handling_note: "Training material only. Do not enter case-specific victim information.",
  },
  {
    id: "dv-safety-plan-victims-page-2",
    title: "Safety Plan for Victims, Page 2",
    file_type: "PDF",
    file_name: "dv-safety-plan-victims-page-2.pdf",
    download_name: "Safety-Plan-for-Victims-Page-2.pdf",
    content_type: "application/pdf",
    description: "Victim-safety planning reference, page 2.",
    handling_note: "Training material only. Do not enter case-specific victim information.",
  },
  {
    id: "dv-strangulation-assessment-card-v4",
    title: "Strangulation Assessment Card v4",
    file_type: "PDF",
    file_name: "dv-strangulation-assessment-card-v4.pdf",
    download_name: "Strangulation-Assessment-Card-v4.pdf",
    content_type: "application/pdf",
    description: "Uploaded strangulation assessment training card.",
    handling_note: "Verify the approved version; follow current medical and agency protocols.",
  },
  {
    id: "dv-strangulation-checklist",
    title: "Strangulation Checklist",
    file_type: "PDF",
    file_name: "dv-strangulation-checklist.pdf",
    download_name: "Strangulation-Checklist.pdf",
    content_type: "application/pdf",
    description: "Uploaded strangulation checklist for training reference.",
    handling_note: "Training reference only. Follow current medical and agency protocols.",
  },
  {
    id: "dv-strangulation-physiological-consequences",
    title: "Strangulation: Physiological Consequences",
    file_type: "PDF",
    file_name: "dv-strangulation-physiological-consequences.pdf",
    download_name: "Strangulation-Physiological-Consequences.pdf",
    content_type: "application/pdf",
    description: "Uploaded reference on physiological consequences of strangulation.",
    handling_note: "Training reference only. Follow current medical and agency protocols.",
  },
  {
    id: "dv-types-of-abuse-worksheet-1",
    title: "Worksheet 1: Types of Abuse",
    file_type: "PDF",
    file_name: "dv-types-of-abuse-worksheet-1.pdf",
    download_name: "Worksheet-1-Types-of-Abuse.pdf",
    content_type: "application/pdf",
    description: "Uploaded domestic-violence training worksheet.",
    handling_note: "Training reference only. Follow current agency policy and protocol.",
  },
] as const;

export type ResourceId = (typeof RESOURCE_FILES)[number]["id"];
export type ResourceFile = (typeof RESOURCE_FILES)[number];

const resourceById = new Map<string, ResourceFile>(
  RESOURCE_FILES.map((resource) => [resource.id, resource]),
);

export function getResourceById(id: string): ResourceFile | undefined {
  return resourceById.get(id);
}

export function createResourceCatalogEnvelope() {
  return ListResourcesResponse.parse({
    status: "success",
    metadata: { total_records: RESOURCE_FILES.length },
    data: RESOURCE_FILES.map(
      ({ id, title, file_type, description, handling_note }) => ({
        id,
        title,
        file_type,
        description,
        handling_note,
      }),
    ),
  });
}

export function getResourceFileNames(): readonly string[] {
  return RESOURCE_FILES.map((resource) => resource.file_name);
}
