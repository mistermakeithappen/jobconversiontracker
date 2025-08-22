import { cn } from '@/lib/utils/cn';

interface ComingSoonBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function ComingSoonBadge({ className, size = 'sm' }: ComingSoonBadgeProps) {
  return (
    <span 
      className={cn(
        "inline-flex items-center font-medium bg-yellow-100 text-yellow-800 border border-yellow-200 rounded-full",
        size === 'sm' ? "px-2 py-1 text-xs" : "px-3 py-1 text-sm",
        className
      )}
    >
      Coming Soon
    </span>
  );
}
