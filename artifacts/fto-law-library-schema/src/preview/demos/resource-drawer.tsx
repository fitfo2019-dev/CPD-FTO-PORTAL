import { useCallback, useState } from "react";
import { ResourceDrawer } from "../../components/ui/resource-drawer.js";
import { exampleResources, PageTitle } from "../foundations.js";
export default function DrawerDemo() {
  const [open,setOpen] = useState(false); const close = useCallback(() => setOpen(false),[]);
  return <><PageTitle eyebrow="OVERLAYS / RESOURCE DRAWER" title="Details, without losing place." description="The source’s controlled panel, unavailable-document placeholder and disabled open action. Escape, backdrop and close button dismiss it; keyboard focus returns to its trigger."/>
    <button className="ds-primary-button" type="button" onClick={() => setOpen(true)}>Open resource preview</button>
    <ResourceDrawer resource={open ? exampleResources[0] : null} onClose={close}/></>;
}
