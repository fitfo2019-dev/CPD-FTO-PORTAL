import React from 'react';
import { expandArrestClassificationShortcut } from '@/lib/arrest-classification.js';

interface ArrestClassificationFieldsProps {
  severity: string;
  arrestType: string;
  disabled: boolean;
  inputClassName: string;
  onSeverityChange: (value: string) => void;
  onArrestTypeChange: (value: string) => void;
  onEdit?: () => void;
}

export function ArrestClassificationFields({
  severity,
  arrestType,
  disabled,
  inputClassName,
  onSeverityChange,
  onArrestTypeChange,
  onEdit,
}: ArrestClassificationFieldsProps) {
  return (
    <>
      <label className="block space-y-1">
        <span className="label-caps">Arrest severity</span>
        <input
          type="text"
          disabled={disabled}
          autoComplete="off"
          className={inputClassName}
          value={severity}
          placeholder="Felony/Misdemeanor"
          maxLength={32}
          onChange={event => {
            onSeverityChange(expandArrestClassificationShortcut('severity', event.target.value));
            onEdit?.();
          }}
          data-testid="input-arrest-severity"
        />
      </label>
      <label className="block space-y-1">
        <span className="label-caps">Arrest type</span>
        <input
          type="text"
          disabled={disabled}
          autoComplete="off"
          className={inputClassName}
          value={arrestType}
          placeholder="Warrant/On-view"
          maxLength={32}
          onChange={event => {
            onArrestTypeChange(expandArrestClassificationShortcut('type', event.target.value));
            onEdit?.();
          }}
          data-testid="input-arrest-type"
        />
      </label>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Shortcuts: F = Felony · M = Misdemeanor · W = Warrant · O = On-view. Actual charge names are not entered here.
      </p>
    </>
  );
}
