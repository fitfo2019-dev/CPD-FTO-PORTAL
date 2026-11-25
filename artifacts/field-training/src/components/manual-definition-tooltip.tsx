import { Info } from 'lucide-react';
import { type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.js';
import { cn } from '@/lib/utils.js';

export function ManualDefinitionTooltip({
  label,
  definition,
  reference,
  children,
  className,
}: {
  label: string;
  definition: string;
  reference: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`FTO Manual definition: ${label}`}
          className={cn('manual-definition-trigger', className)}
        >
          <span>{children}</span>
          <Info aria-hidden="true" className="manual-definition-icon" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="manual-definition-content"
      >
        <span className="manual-definition-title">{label}</span>
        <p className="manual-definition-text">{definition}</p>
        <span className="manual-definition-reference">{reference}</span>
      </TooltipContent>
    </Tooltip>
  );
}
