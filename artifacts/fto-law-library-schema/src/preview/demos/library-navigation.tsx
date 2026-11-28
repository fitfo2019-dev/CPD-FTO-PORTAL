import { useState } from "react";
import { FileText, FolderOpen, Library } from "lucide-react";
import { LibraryNavigation } from "../../components/ui/library-navigation.js";
import { PageTitle } from "../foundations.js";
export default function NavigationDemo() {
  const [category,setCategory] = useState("All resources");
  return <><PageTitle eyebrow="NAVIGATION" title="A clear starting point." description="Source collection buttons retain controlled selection, counts, icons and pressed states."/>
    <div style={{maxWidth:380}}><LibraryNavigation category={category} onCategoryChange={setCategory} collections={[
      { name:"All resources", icon:<FolderOpen size={15}/>, count:10 },
      { name:"Law Library", icon:<Library size={15}/>, count:"—" },
      { name:"Reference documents", icon:<FileText size={15}/>, count:10 },
    ]}/></div><p className="ds-muted" role="status">Selected collection: {category}</p></>;
}
