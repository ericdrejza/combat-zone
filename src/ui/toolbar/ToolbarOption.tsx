import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  PropsWithChildren
} from "react";

const TOOLBAR_OPTION_ROW_CLASS_NAME = "flex shrink-0 items-center gap-2";
const TOOLBAR_OPTION_GROUP_CLASS_NAME =
  "flex gap-1 rounded-full border border-canvas-line bg-white/75 p-1 shadow-sm";

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
    ? "border-canvas-ink bg-canvas-ink text-white"
    : "border-canvas-line bg-white text-canvas-muted hover:bg-canvas";

  return (
    <button
      {...props}
      className={joinClassNames(
        "flex h-8 min-w-10 items-center justify-center gap-1 rounded-full border px-1.5 transition",
        stateClassName,
        className
      )}
    >
      {children}
    </button>
  );
}

type ToolbarOptionKeybindProps = PropsWithChildren<{
  active?: boolean;
}>;

export function ToolbarOptionKeybind({
  active = false,
  children
}: ToolbarOptionKeybindProps) {
  const className = active ? "text-white/60" : "text-canvas-muted/70";

  return (
    <span
      aria-hidden="true"
      className={joinClassNames("text-[10px] leading-none", className)}
    >
      {children}
    </span>
  );
}
