import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** The text beside the box. Clicking it toggles, and it names the box for screen readers. */
  label: string;
}

/**
 * A checkbox with a label beside it, styled for the auth screens. The label is clickable and
 * toggles the checkbox when clicked.
 */
export const AuthCheckbox = forwardRef<HTMLInputElement, AuthCheckboxProps>(
  ({ label, className, id, ...props }, ref) => {
    // The association needs an id even when the caller does not supply one.
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <div className={cn('inline-flex items-center gap-2', className)}>
        <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className="peer h-3.5 w-3.5 cursor-pointer appearance-none rounded-[4px] border border-placeholder bg-transparent transition-colors checked:border-transparent checked:bg-btn hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            {...props}
          />
          <Check
            aria-hidden
            strokeWidth={3}
            className="pointer-events-none absolute h-2.5 w-2.5 text-btn-foreground opacity-0 peer-checked:opacity-100"
          />
        </span>
        <label htmlFor={inputId} className="cursor-pointer select-none text-xs text-link">
          {label}
        </label>
      </div>
    );
  },
);
AuthCheckbox.displayName = 'AuthCheckbox';
