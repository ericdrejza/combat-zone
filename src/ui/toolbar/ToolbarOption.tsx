import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  PropsWithChildren
} from "react";
import { TouchTooltip } from "./TouchTooltip";

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
};

export function ToolbarOptionButton({
  active = false,
  children,
  className,
  ...props
}: ToolbarOptionButtonProps) {
  const stateClassName = active
    ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink"
    : "border-canvas-line bg-canvas-surface text-canvas-muted hover:bg-canvas";

  return (
    <TouchTooltip
      label={
        typeof props.title === "string"
          ? props.title
          : typeof props["aria-label"] === "string"
            ? props["aria-label"]
            : ""
      }
    >
      <button
        {...props}
        className={joinClassNames(
          "flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-1.5 transition lg:h-8 lg:min-w-10",
          stateClassName,
          className
        )}
      >
        {children}
      </button>
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
