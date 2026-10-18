import { useLayoutEffect, useMemo, useRef } from "react";
import { ZoneVisual } from "./ZoneVisual";
import { ZoneResizeHandles } from "./ZoneResizeHandles";
import type { ZoneLayerProps } from "./zoneLayerTypes";

type Handlers = Pick<ZoneLayerProps, "onResizeHandleDrag" | "onResizeHandleDragEnd" |
  "onResizeHandleMouseDown" | "onZoneMotionComplete">;

export function ZoneLayer(props: ZoneLayerProps) {
  // Memoized visuals need stable callbacks that still see the current gesture.
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; });
  const handlers = useMemo<Handlers>(() => ({
    onResizeHandleDrag: (point, gestureId, timeStamp) => latest.current.onResizeHandleDrag(point, gestureId, timeStamp),
    onResizeHandleDragEnd: (event, gestureId) => latest.current.onResizeHandleDragEnd(event, gestureId),
    onResizeHandleMouseDown: (...args) => latest.current.onResizeHandleMouseDown(...args),
    onZoneMotionComplete: () => { if (latest.current.zoneDrag?.phase === "committed") latest.current.onZoneMotionComplete(); }
  }), []);

  const zones = props.encounter.zones.allIds.map(zoneId => {
    const zone = props.encounter.zones.byId[zoneId];
    if (!zone) return null;
    const zoneDrag = props.zoneDrag?.zoneId === zoneId ? props.zoneDrag : null;
    const previewingOpacity = props.zoneOpacityPreview?.zoneId === zoneId;
    return <ZoneVisual key={zoneId} {...handlers}
      zone={zone}
      encounter={zone.showSectionDividers && zone.layoutStrategy.startsWith("SPLIT") ? props.encounter : undefined}
      polygon={zoneDrag?.phase === "dragging" ? zoneDrag.originalPolygon : props.getDisplayedPolygon(zone)}
      zoneDrag={zoneDrag}
      selected={props.selection.selectedEntityType === "zone" && props.selection.selectedIds.includes(zoneId)}
      actorTargeted={props.actorTargetZoneId === zoneId}
      directManipulation={props.directManipulationZoneId === zoneId}
      previewingOpacity={previewingOpacity}
      renderedOpacity={previewingOpacity ? props.zoneOpacityPreview!.opacity : zone.opacity}
      backgroundLuminance={props.backgroundLuminanceByZoneId[zoneId]}
    />;
  });
  return <>{zones}{props.activeToolId === 'zone' && props.selection.selectedEntityType === 'zone'
    ? props.selection.selectedIds.map(zoneId => {
      const zone = props.encounter.zones.byId[zoneId];
      if (!zone) return null;
      const zoneDrag = props.zoneDrag?.zoneId === zoneId ? props.zoneDrag : null;
      return <ZoneResizeHandles key={zoneId} {...handlers} zone={zone} zoneDrag={zoneDrag}
        polygon={zoneDrag?.phase === 'dragging' ? zoneDrag.originalPolygon : props.getDisplayedPolygon(zone)}
        direct={props.directManipulationZoneId === zoneId} />;
    }) : null}</>;
}
