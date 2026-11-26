import type { ReactNode } from "react";
import { PageHead } from "@/components/bits.js";
import type { PhotoKey } from "@/lib/photos.js";
import { useWorkspace } from "@/state/workspace";

export function PageHeader({ section, title, actions, photo }: { section: string; title: string; actions?: ReactNode; photo?: PhotoKey }) {
  const { ws } = useWorkspace();
  const kicker = section === "Coordinator" && ws.role === "fto_sgt" ? "FTO Sergeant" : section;
  return <PageHead kicker={kicker} title={title} photo={photo}>{actions}</PageHead>;
}
