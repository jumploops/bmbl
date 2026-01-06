import { cn } from '@/lib/utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'sm' | 'md';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={cn(
        'font-medium rounded transition-colors cursor-pointer',
        // Size
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2',
        // Variant
        variant === 'primary' && [
          'bg-hn-header text-white',
          'hover:bg-orange-600',
          'disabled:bg-gray-400 disabled:cursor-not-allowed',
        ],
        variant === 'secondary' && [
          'bg-gray-100 dark:bg-gray-700 text-hn-text',
          'border border-gray-300 dark:border-gray-600',
          'hover:bg-gray-200 dark:hover:bg-gray-600',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        ],
        variant === 'destructive' && [
          'bg-destructive text-destructive-foreground',
          'hover:bg-red-700 dark:hover:bg-red-600',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        ],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
