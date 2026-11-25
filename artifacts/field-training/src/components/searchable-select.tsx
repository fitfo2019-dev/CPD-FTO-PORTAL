import React, { forwardRef, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { rankSearchChoices } from '@/lib/search-match.js';

type SelectOption = {
  value: string;
  label: string;
  searchText: string;
  disabled: boolean;
};

type SearchableSelectProps = Omit<React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'size'> & {
    value?: string | number;
    defaultValue?: string | number;
    onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  containerClassName?: string;
    children: React.ReactNode;
  };

function nodeText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return nodeText(node.props.children);
  return '';
}

function collectOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  React.Children.forEach(children, child => {
    if (!React.isValidElement<{ value?: string | number; children?: React.ReactNode; disabled?: boolean; 'data-search'?: string }>(child)) return;
    if (child.type === React.Fragment) {
      options.push(...collectOptions(child.props.children));
      return;
    }
    if (child.type !== 'option') return;
    const label = nodeText(child.props.children).trim();
    const value = String(child.props.value ?? label);
    options.push({
      value,
      label,
      searchText: `${label} ${value} ${child.props['data-search'] ?? ''}`,
      disabled: !!child.props.disabled,
    });
  });
  return options;
}

export const SearchableSelect = forwardRef<HTMLInputElement, SearchableSelectProps>(function SearchableSelect({
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  children,
  className = '',
  disabled = false,
  name,
  id,
  placeholder,
  autoComplete,
  containerClassName = '',
  ...inputProps
}, ref) {
  const generatedId = useId().replace(/:/g, '');
  const listboxId = `searchable-select-${generatedId}`;
  const [uncontrolledValue, setUncontrolledValue] = useState(String(defaultValue ?? ''));
  const [query, setQuery] = useState('');
  const [hasQuery, setHasQuery] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = useMemo(() => collectOptions(children), [children]);
  const selectedValue = String(value ?? uncontrolledValue);
  const selected = options.find(option => option.value === selectedValue);
  const filtered = useMemo(() => rankSearchChoices(options, hasQuery ? query : ''), [options, query, hasQuery]);
  const displayValue = open && hasQuery ? query : selected?.label ?? selectedValue;

  const choose = (option: SelectOption) => {
    if (option.disabled) return;
    if (value === undefined) setUncontrolledValue(option.value);
    const event = {
      target: { name, value: option.value },
      currentTarget: { name, value: option.value },
    } as unknown as React.ChangeEvent<HTMLSelectElement>;
    onChange?.(event);
    setQuery('');
    setHasQuery(false);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    inputProps.onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => Math.min(index + 1, Math.max(0, filtered.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && open && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
      setHasQuery(false);
    }
  };

  return <div
    ref={rootRef}
    className={`relative min-w-0 ${containerClassName}`}
    onBlur={event => {
      if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) return;
      window.setTimeout(() => {
        setOpen(false);
        setQuery('');
        setHasQuery(false);
      }, 0);
    }}
  >
    <input
      ref={ref}
      type="hidden"
      name={name}
      value={selectedValue}
      disabled={disabled}
      readOnly
      tabIndex={-1}
      aria-hidden="true"
    />
    <input
      {...inputProps}
      id={id}
      type="text"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-activedescendant={open && filtered[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
      aria-label={inputProps['aria-label']}
      autoComplete={autoComplete ?? 'off'}
      title={inputProps.title ?? 'Type letters or numbers to search options'}
      disabled={disabled}
      className={`${className} pr-9`}
      value={displayValue}
      placeholder={placeholder ?? (selected ? '' : 'Type to search')}
      onFocus={event => {
        setOpen(true);
        setQuery('');
        setHasQuery(false);
        setActiveIndex(0);
        event.currentTarget.select();
        onFocus?.(event);
      }}
      onClick={() => setOpen(true)}
      onChange={event => {
        setQuery(event.target.value);
        setHasQuery(true);
        setOpen(true);
        setActiveIndex(0);
      }}
      onBlur={event => {
        if (name) {
          const blurEvent = {
            target: { name, value: selectedValue },
            currentTarget: { name, value: selectedValue },
          } as unknown as React.FocusEvent<HTMLInputElement>;
          onBlur?.(blurEvent);
        } else {
          onBlur?.(event as unknown as React.FocusEvent<HTMLInputElement>);
        }
      }}
      onKeyDown={handleKeyDown}
    />
    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
    {open && !disabled && <div
      id={listboxId}
      role="listbox"
      className="absolute z-50 mt-1 max-h-60 w-full min-w-48 overflow-auto rounded border bg-popover p-1 text-popover-foreground shadow-lg"
    >
      {filtered.length ? filtered.map((option, index) => <div
        key={`${option.value}-${index}`}
        id={`${listboxId}-option-${index}`}
        role="option"
        aria-selected={index === activeIndex}
        aria-disabled={option.disabled}
        className={`block min-h-10 w-full rounded px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent/70 ${option.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(option)}
      >{option.label || '—'}</div>) : <p className="px-3 py-2 text-sm text-muted-foreground">No close matches</p>}
    </div>}
  </div>;
});
