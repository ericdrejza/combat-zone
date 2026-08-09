import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

if (!globalThis.PointerEvent) {
  class TestPointerEvent extends MouseEvent {
    readonly isPrimary: boolean;
    readonly pointerId: number;
    readonly pointerType: string;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.isPrimary = init.isPrimary ?? true;
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }

  globalThis.PointerEvent = TestPointerEvent as typeof PointerEvent;
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.hasPointerCapture = () => false;
}

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const React = await import("react");

  // jsdom has no SVG geometry or Motion frame model. This intrinsic cache
  // keeps component identities stable while exposing deterministic targets
  // and the same drag callback lifecycle used by production components.
  const componentCache = new Map<
    string,
    React.ForwardRefExoticComponent<Record<string, unknown>>
  >();
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const cached = componentCache.get(tag);

        if (cached) {
          return cached;
        }

        const component = React.forwardRef<SVGElement, Record<string, unknown>>(
          function MotionTestElement(props, ref) {
            const latestProps = React.useRef(props);
            const firstRender = React.useRef(true);
            const lastMotionPath = React.useRef<string>();
            const lastTarget = React.useRef({ x: 0, y: 0 });
            const positionHistory = React.useRef<Array<{ x: number; y: number }>>(
              []
            );
            const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
            latestProps.current = props;
            const {
              animate,
              children,
              drag,
              dragElastic: _dragElastic,
              dragMomentum: _dragMomentum,
              dragSnapToOrigin,
              initial,
              onDrag: _onDrag,
              onDragEnd: _onDragEnd,
              onDragStart: _onDragStart,
              onDragTransitionEnd: _onDragTransitionEnd,
              onAnimationComplete,
              transition: _transition,
              ...elementProps
            } = props;
            const animated =
              firstRender.current &&
              initial &&
              typeof initial === "object"
                ? (initial as Record<string, unknown>)
                : ((animate ?? {}) as Record<string, unknown>);
            firstRender.current = false;
            const style = {
              ...(elementProps.style as React.CSSProperties | undefined)
            };

            const targetX = Array.isArray(animated.x)
              ? animated.x.at(-1)
              : animated.x;
            const targetY = Array.isArray(animated.y)
              ? animated.y.at(-1)
              : animated.y;
            if (typeof targetX === "number") {
              lastTarget.current.x = targetX;
            }
            if (typeof targetY === "number") {
              lastTarget.current.y = targetY;
            }
            if (Array.isArray(animated.x) || Array.isArray(animated.y)) {
              lastMotionPath.current = JSON.stringify({
                x: animated.x,
                y: animated.y
              });
            }

            if (
              typeof targetX === "number" ||
              typeof targetY === "number" ||
              dragOffset.x !== 0 ||
              dragOffset.y !== 0
            ) {
              const renderedPosition = {
                x: lastTarget.current.x + dragOffset.x,
                y: lastTarget.current.y + dragOffset.y
              };
              const previousPosition = positionHistory.current.at(-1);

              if (
                !previousPosition ||
                previousPosition.x !== renderedPosition.x ||
                previousPosition.y !== renderedPosition.y
              ) {
                positionHistory.current.push(renderedPosition);
              }
              style.transform = `translateX(${renderedPosition.x}px) translateY(${renderedPosition.y}px)`;
            }

            const animatedAttributes = Object.fromEntries(
              Object.entries(animated).flatMap(([key, value]) => {
                if (key === "x" || key === "y") {
                  return [];
                }
                if (key === "attrX") {
                  return [["x", value]];
                }
                if (key === "attrY") {
                  return [["y", value]];
                }
                return [[key, Array.isArray(value) ? value.at(-1) : value]];
              })
            );

            function handleMouseDown(event: React.MouseEvent<SVGElement>) {
              (
                elementProps.onMouseDown as
                  | ((event: React.MouseEvent<SVGElement>) => void)
                  | undefined
              )?.(event);

              if (!drag) {
                return;
              }

              const dragInfo = (mouseEvent: MouseEvent) => ({
                delta: { x: 0, y: 0 },
                offset: {
                  x: mouseEvent.clientX - event.clientX,
                  y: mouseEvent.clientY - event.clientY
                },
                point: { x: mouseEvent.clientX, y: mouseEvent.clientY },
                velocity: { x: 0, y: 0 }
              });
              const handleMove = (mouseEvent: MouseEvent) => {
                setDragOffset(dragInfo(mouseEvent).offset);
                (
                  latestProps.current.onDrag as
                    | ((event: MouseEvent, info: ReturnType<typeof dragInfo>) => void)
                    | undefined
                )?.(mouseEvent, dragInfo(mouseEvent));
              };
              const handleUp = (mouseEvent: MouseEvent) => {
                window.removeEventListener("mousemove", handleMove);
                window.removeEventListener("mouseup", handleUp);
                (
                  latestProps.current.onDragEnd as
                    | ((event: MouseEvent, info: ReturnType<typeof dragInfo>) => void)
                    | undefined
                )?.(mouseEvent, dragInfo(mouseEvent));
                setDragOffset({ x: 0, y: 0 });
              };

              (
                latestProps.current.onDragStart as
                  | ((
                      event: MouseEvent,
                      info: ReturnType<typeof dragInfo>
                    ) => void)
                  | undefined
              )?.(event.nativeEvent, dragInfo(event.nativeEvent));
              window.addEventListener("mousemove", handleMove);
              window.addEventListener("mouseup", handleUp);
            }

            React.useEffect(() => {
              (
                onAnimationComplete as (() => void) | undefined
              )?.();
            }, [animate, onAnimationComplete]);

            return React.createElement(
              tag,
              {
                ...elementProps,
                ...animatedAttributes,
                ...(dragSnapToOrigin
                  ? { "data-drag-snap-to-origin": "true" }
                  : {}),
                ...(lastMotionPath.current
                  ? { "data-motion-path": lastMotionPath.current }
                  : {}),
                ...(positionHistory.current.length > 0
                  ? {
                      "data-motion-position-history": JSON.stringify(
                        positionHistory.current
                      )
                    }
                  : {}),
                onMouseDown: handleMouseDown,
                ref,
                style
              },
              children as React.ReactNode
            );
          }
        );

        componentCache.set(tag, component);
        return component;
      }
    }
  ) as typeof actual.motion;

  return {
    ...actual,
    MotionConfig: ({ children }: { children: React.ReactNode }) => children,
    motion,
    useReducedMotion: () => false
  };
});
