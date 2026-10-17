"use client";

import Link from "next/link";
import { forwardRef, useId } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 border border-transparent",
  secondary: "bg-surface text-ink border border-border hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink border border-transparent",
  danger: "bg-surface text-bad border border-border hover:bg-bad-soft",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 px-2.5 text-sm gap-1.5",
  md: "h-10 px-3.5 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex items-center justify-center rounded-lg font-medium transition-[background,filter,color] disabled:opacity-50 disabled:cursor-not-allowed select-none",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  newTab,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
  /** Open in a new tab so the current game / puzzle session is kept. */
  newTab?: boolean;
}) {
  return (
    <Link
      href={href}
      {...(newTab ? { target: "_blank", rel: "noopener" } : {})}
      className={cx("inline-flex items-center justify-center rounded-lg font-medium transition-[background,filter]", VARIANT[variant], SIZE[size], className)}
    >
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-10 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("card", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cx("text-xs font-semibold uppercase tracking-wider text-ink-3", className)}>{children}</h2>;
}

type Tone = "info" | "success" | "warning" | "error";
const TONE: Record<Tone, { cls: string; Icon: typeof Info }> = {
  info: { cls: "bg-info-soft text-ink border-info/30", Icon: Info },
  success: { cls: "bg-good-soft text-ink border-good/30", Icon: CheckCircle2 },
  warning: { cls: "bg-warn-soft text-ink border-warn/30", Icon: AlertTriangle },
  error: { cls: "bg-bad-soft text-ink border-bad/30", Icon: XCircle },
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
  id,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const { cls, Icon } = TONE[tone];
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={cx("flex gap-3 rounded-lg border p-3 text-sm", cls, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-ink-2">{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint ? (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} className="text-xs font-medium text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus-visible:outline-2 aria-[invalid=true]:border-bad";

export function Spinner({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-ink-2">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: { id: T; label: React.ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cx("inline-flex rounded-lg border border-border bg-surface-2 p-1", className)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const idx = tabs.findIndex((t) => t.id === value);
        const next = tabs[(idx + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        onChange(next.id);
        const el = (e.currentTarget as HTMLElement).querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`);
        el?.focus();
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          data-tab={t.id}
          aria-selected={t.id === value}
          tabIndex={t.id === value ? 0 : -1}
          onClick={() => onChange(t.id)}
          className={cx(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            t.id === value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {description ? <p className="text-xs text-ink-3">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border transition-colors",
          checked ? "bg-accent" : "bg-surface-2",
        )}
      >
        <span
          className={cx("inline-block size-4 rounded-full bg-surface shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")}
        />
      </button>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
      {icon ? <div className="text-ink-3">{icon}</div> : null}
      <p className="font-medium text-ink">{title}</p>
      {children ? <div className="max-w-md text-sm text-ink-2">{children}</div> : null}
    </div>
  );
}
