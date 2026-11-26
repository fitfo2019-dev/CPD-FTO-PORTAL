import type { ReactNode } from "react";
import { PageHead } from "@/components/bits.js";
import { useWorkspace } from "@/state/workspace";

export function PageHeader({ section, title, actions }: { section: string; title: string; actions?: ReactNode }) {
  const { ws } = useWorkspace();
  const kicker = section === "Coordinator" && ws.role === "fto_sgt" ? "FTO Sergeant" : section;
  return <PageHead kicker={kicker} title={title}>{actions}</PageHead>;
}
