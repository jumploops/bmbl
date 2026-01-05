import { cn } from '@/lib/utils/cn';

interface SelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
  id?: string;
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
  id,
}: SelectProps<T>) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      disabled={disabled}
      className={cn(
        'border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm cursor-pointer',
        'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
        'focus:outline-none focus:ring-2 focus:ring-hn-header',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}
