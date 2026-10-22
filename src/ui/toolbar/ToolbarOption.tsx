import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  PropsWithChildren
} from "react";
import { TouchTooltip } from "./TouchTooltip";
import { RepeatButton } from "@ui/controls/RepeatButton";

const TOOLBAR_OPTION_ROW_CLASS_NAME = "flex shrink-0 items-center gap-2";
const TOOLBAR_OPTION_GROUP_CLASS_NAME =
  "flex gap-1 rounded-full border border-canvas-line bg-canvas-surface/75 p-1 shadow-sm";

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function ToolbarOptionRow({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      {...props}
      className={joinClassNames(TOOLBAR_OPTION_ROW_CLASS_NAME, className)}
    >
      {children}
    </div>
  );
}

export function ToolbarOptionGroup({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      {...props}
      className={joinClassNames(TOOLBAR_OPTION_GROUP_CLASS_NAME, className)}
    >
      {children}
    </div>
  );
}

type ToolbarOptionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  repeat?: boolean;
};

export function ToolbarOptionButton({
  active = false,
  repeat = false,
  children,
  className,
  ...props
}: ToolbarOptionButtonProps) {
  const Button = repeat ? RepeatButton : "button";
  const label = props.title ?? props["aria-label"] ?? "";
  const stateClassName = props.disabled
    ? "border-canvas-line bg-canvas-surface text-canvas-muted"
    : active
    ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink hover:ring-2 hover:ring-canvas-ink/40"
    : "border-canvas-line bg-canvas-surface text-canvas-muted hover:bg-canvas";

  return (
    <TouchTooltip
      label={repeat && !props.disabled ? `${label} (hold to repeat)` : label}
    >
      <Button
        {...props}
        title={props.title ?? props['aria-label']}
        className={joinClassNames(
          "flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40 lg:h-8 lg:min-w-10",
          stateClassName,
          className
        )}
      >
        {children}
      </Button>
    </TouchTooltip>
  );
}

export function ToolbarSubtoolBar({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      {...props}
      data-toolbar-subtools="true"
      className={joinClassNames(
        "flex min-w-max shrink-0 items-center gap-2 lg:contents",
        className
      )}
    >
      {children}
    </div>
  );
}

type ToolbarOptionKeybindProps = PropsWithChildren<{
  active?: boolean;
}>;

export function ToolbarOptionKeybind({
  active = false,
  children
}: ToolbarOptionKeybindProps) {
  const className = active
    ? "text-canvas-on-ink/60"
    : "text-canvas-muted/70";

  return (
    <span
      aria-hidden="true"
      className={joinClassNames("hidden text-[10px] leading-none lg:inline", className)}
    >
      {children}
    </span>
  );
}
