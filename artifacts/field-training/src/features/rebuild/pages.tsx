import "./rebuild.css";
import { useWorkspace } from "@/state/workspace";
import { PhaseSetup } from "./admin/phase-setup";
import { MyProbationaryOfficer, PhaseSignUp } from "./admin/fto-pages";
import { PoContacts } from "./admin/po-home";
import { AdminPage } from "./admin/ui";
import { PageHeader } from "./portal/page-header";
import { ProgressView } from "./po-progress/progress-view";

export function RebuildPhaseSetup() {
  return <PhaseSetup />;
}

export function RebuildPhaseSignUp() {
  return <PhaseSignUp />;
}

export function RebuildMyProbationaryOfficer() {
  return <MyProbationaryOfficer />;
}

export function RebuildPoProgress() {
  const { ws } = useWorkspace();
  return <AdminPage><PageHeader section="Coordinator" title="PO Progress" photo="cruiser-skyline" /><ProgressView coordinatorScope={ws.role !== "fto_sgt"} /></AdminPage>;
}

/** PO Progress cards without the page header, for the FTO Sergeant home. */
export function RebuildPoProgressCards() {
  return <AdminPage><ProgressView coordinatorScope={false} /></AdminPage>;
}

/** PO contact cards for My Training (sample data until the server roster is live). */
export function RebuildPoContacts() {
  return <PoContacts />;
}
