import { useCallback, useState } from "react";
import { ResourceCard, type LibraryResource } from "../../components/ui/resource-card.js";
import { ResourceDrawer } from "../../components/ui/resource-drawer.js";
import { exampleResources, PageTitle } from "../foundations.js";
export default function CardDemo() {
  const [selected,setSelected] = useState<LibraryResource | null>(null);
  const close = useCallback(() => setSelected(null),[]);
  return <><PageTitle eyebrow="DISCOVERY / RESOURCE CARD" title="A useful first glance." description="Title, collection, optional note and selection affordance. Activate with pointer, Enter or Space."/>
    <div className="fls-grid">{exampleResources.map(resource => <ResourceCard key={resource.title} resource={resource} onSelect={setSelected}/>)}</div>
    <ResourceDrawer resource={selected} onClose={close}/></>;
}
