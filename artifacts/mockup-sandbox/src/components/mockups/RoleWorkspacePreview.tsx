import { useState } from "react";
import {
  BookOpen,
  ClipboardList,
  FolderOpen,
  LockKeyhole,
  Settings2,
  Users,
} from "lucide-react";

const roles = [
  { id: "po", label: "PO", title: "Police Officer" },
  { id: "fto", label: "FTO", title: "Field Training Officer" },
  { id: "coordinator", label: "FTO Coordinator", title: "FTO Coordinator" },
  { id: "coc", label: "FTO COC", title: "Command review" },
  { id: "policenet", label: "POLICENET", title: "Technical support" },
  {
    id: "policenet-admin",
    label: "POLICENET ADMIN — SGT",
    title: "Technical administrator",
  },
] as const;

type RoleId = (typeof roles)[number]["id"];

const screens: Record<RoleId, { label: string; icon: typeof Users }[]> = {
  po: [{ label: "Account Access", icon: LockKeyhole }, { label: "Resources", icon: BookOpen }],
  fto: [
    { label: "Home", icon: Users },
    { label: "My POs", icon: Users },
    { label: "Shifts & Runs", icon: ClipboardList },
    { label: "Daily Records", icon: FolderOpen },
    { label: "Resources", icon: BookOpen },
  ],
  coordinator: [
    { label: "Home", icon: Users },
    { label: "Classes & Rosters", icon: Users },
    { label: "Assignments", icon: FolderOpen },
    { label: "Coverage", icon: ClipboardList },
    { label: "Resources", icon: BookOpen },
  ],
  coc: [{ label: "Submitted Packets", icon: ClipboardList }, { label: "Resources", icon: BookOpen }],
  policenet: [{ label: "Technical Access", icon: Settings2 }, { label: "Resources", icon: BookOpen }],
  "policenet-admin": [{ label: "Technical Access", icon: Settings2 }, { label: "Resources", icon: BookOpen }],
};

const summaries: Record<RoleId, { heading: string; detail: string; stat: string }> = {
  po: {
    heading: "Account access",
    detail: "This sample role can view only its account-access and resource screens.",
    stat: "No recruit or training records",
  },
  fto: {
    heading: "My work",
    detail: "A fictional recruit assignment lets reviewers explore FTO screens.",
    stat: "DEMO PO · Phase 3",
  },
  coordinator: {
    heading: "Coordinator workspace",
    detail: "Fictional class, assignment, and coverage examples for review.",
    stat: "DEMO CLASS · 1 sample assignment",
  },
  coc: {
    heading: "Submitted packets",
    detail: "A sample command queue shows the screens available to FTO COC.",
    stat: "1 fictional packet",
  },
  policenet: {
    heading: "Technical access",
    detail: "Technical-role previews contain no training or recruit workspace.",
    stat: "Access information only",
  },
  "policenet-admin": {
    heading: "Technical access",
    detail: "Admin-role previews contain no training or recruit workspace.",
    stat: "Access information only",
  },
};

export default function RoleWorkspacePreview() {
  const [role, setRole] = useState<RoleId>("coordinator");
  const selectedRole = roles.find((item) => item.id === role)!;

  return (
    <main className="min-h-screen bg-[#eef1f4] font-sans text-[#28313d]">
      <div className="border-t-[3px] border-[#c92535] bg-[#fff5df] px-4 py-2 text-center text-xs font-semibold text-[#4b3911]">
        DISPOSABLE ROLE PREVIEW · Fictional data only · Memory only · No portal or record access
      </div>
      <header className="bg-[#102c4d] text-white shadow-sm">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="flex min-h-28 items-center justify-center">
            <div className="text-center">
              <div className="text-xs font-medium tracking-[0.2em] text-white/85">DIVISION OF POLICE</div>
              <h1 className="mt-1 text-2xl font-bold tracking-wide">Field Training Officer Portal</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/15 py-3">
            <nav aria-label="Preview screens" className="flex flex-wrap gap-1">
              {screens[role].map(({ label, icon: Icon }, index) => (
                <span
                  key={label}
                  className={`inline-flex min-h-10 items-center gap-2 border-b-[3px] px-3 text-sm font-semibold ${
                    index === 0
                      ? "border-[#ca2638] text-white"
                      : "border-transparent text-white/75"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              ))}
            </nav>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/80">
              <span>Preview role</span>
              <select
                aria-label="Preview role"
                value={role}
                onChange={(event) => setRole(event.target.value as RoleId)}
                className="h-10 min-w-56 rounded-sm border border-white/40 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-[#172b46]"
              >
                {roles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label} · fictional preview
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </header>

      <div className="border-b border-[#d7dce2] bg-white px-6 py-3">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-[#154c7a]">Fictional {selectedRole.title} preview</span>
          <span className="text-[#59636f]">Not operational · Data clears when this preview is refreshed</span>
        </div>
      </div>

      <section className="mx-auto max-w-[1180px] px-6 py-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5d6873]">
          Role-specific sample workspace
        </p>
        <h2 className="mt-2 text-3xl font-bold text-[#1d2937]">{summaries[role].heading}</h2>
        <p className="mt-2 max-w-2xl text-base leading-7 text-[#535e69]">{summaries[role].detail}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
          <article className="rounded-sm border border-[#cdd4dc] bg-white shadow-sm">
            <div className="border-b border-[#dce1e6] px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#4f5b66]">
              Fictional sample
            </div>
            <div className="p-5">
              <p className="text-lg font-bold text-[#1d2937]">{summaries[role].stat}</p>
              <p className="mt-2 text-sm leading-6 text-[#59636f]">
                This workspace is isolated from real accounts and agency records. Switching roles replaces its sample data.
              </p>
              <button
                type="button"
                disabled
                className="mt-5 min-h-10 cursor-not-allowed rounded-sm border border-[#cbd2da] bg-[#f5f6f7] px-4 text-sm font-semibold text-[#69737e]"
              >
                Preview only · actions disabled
              </button>
            </div>
          </article>
          <aside className="rounded-sm border border-[#d7c99f] bg-[#fff8e8] p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-[#6a5319]">Safety boundary</div>
            <p className="mt-2 text-sm leading-6 text-[#51462c]">
              Sample edits stay in memory. No shared-service requests, uploads, or operational records are used.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
