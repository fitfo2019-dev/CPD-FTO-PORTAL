import { EmptyState } from "../../components/ui/empty-state.js";
import { PageTitle } from "../foundations.js";
export default function EmptyDemo() {
  return <><PageTitle eyebrow="FEEDBACK / EMPTY RESULTS" title="No dead ends." description="Source search feedback, with optional title and description for other empty collections. It does not imply a network or authorization failure."/>
    <EmptyState/><h2 className="ds-subheading">Empty collection</h2>
    <EmptyState title="No resources in this collection" description="Choose another collection to continue browsing."/></>;
}
