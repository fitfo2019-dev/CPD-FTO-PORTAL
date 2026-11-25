import React, { type CSSProperties } from "react";
import { tokens } from "@workspace/fto-law-library-schema/tokens";
import {
  AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription,
  AlertDialogCancel, AlertDialogFooter,
} from "@/components/ui/alert-dialog.js";

export const profileClearTheme = {
  "--op-clear-card": `light-dark(${tokens.color.light.card}, ${tokens.color.dark.card})`,
  "--op-clear-ink": `light-dark(${tokens.color.light.cardForeground}, ${tokens.color.dark.cardForeground})`,
  "--op-clear-border": `light-dark(${tokens.color.light.border}, ${tokens.color.dark.border})`,
  "--op-clear-danger": `light-dark(${tokens.color.light.destructive}, ${tokens.color.dark.destructive})`,
  "--op-clear-danger-ink": `light-dark(${tokens.color.light.destructiveForeground}, ${tokens.color.dark.destructiveForeground})`,
  "--op-clear-ring": `light-dark(${tokens.color.light.primary}, ${tokens.color.dark.primary})`,
  "--op-clear-font": tokens.fontFamily.sans.join(", "),
  "--op-clear-heading": tokens.fontFamily.heading.join(", "),
  "--op-clear-spacing": tokens.spacing,
  "--op-clear-radius": tokens.radius,
} as CSSProperties;

export function OperationalProfileClearDialog({ open, onOpenChange, confirmed, onConfirmedChange, pending, onConfirm }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  confirmed: boolean;
  onConfirmedChange(confirmed: boolean): void;
  pending: boolean;
  onConfirm(): void;
}) {
  return <AlertDialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}>
    <AlertDialogContent className="op-clear-scope op-clear-dialog" style={profileClearTheme}
      onEscapeKeyDown={event => { if (pending) event.preventDefault(); }}>
      <AlertDialogTitle className="uppercase">Clear operational assignment?</AlertDialogTitle>
      <AlertDialogDescription>
        Only the current operational vehicle assignment will be cleared. Your account, training assignment,
        and saved packets remain unchanged. Future packets will use manual vehicle entry.
      </AlertDialogDescription>
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={confirmed} disabled={pending}
          onChange={event => onConfirmedChange(event.target.checked)} data-testid="checkbox-clear-no-vehicle"/>
        <span>I have no vehicle currently assigned</span>
      </label>
      <AlertDialogFooter>
        <AlertDialogCancel type="button" disabled={pending} className="uppercase">Cancel</AlertDialogCancel>
        <button type="button" disabled={!confirmed || pending} onClick={onConfirm}
          className="op-clear-button" data-testid="button-confirm-clear-profile">
          {pending ? "Clearing…" : "Confirm clear assignment"}
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
