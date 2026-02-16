import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input/75 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/70 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-lg border bg-background/70 px-3 py-2 text-base shadow-[0_8px_16px_-14px_rgba(15,23,42,0.8)] transition-[color,box-shadow,border-color,background-color] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
