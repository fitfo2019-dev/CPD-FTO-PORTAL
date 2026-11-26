import { Info } from 'lucide-react';

export function DaisyStatusNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="alert flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-foreground shadow-none"
      role="status"
      aria-live="polite"
      data-testid="status-daisyui-notice"
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
