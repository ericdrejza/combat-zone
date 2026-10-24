import { usePlayerAudience } from '@ui/player_view/PlayerSceneSource';
import { previewedName } from '@interaction/namePreviewState';
import { useSelector } from "react-redux";
import type { RootState } from "@store/store";
import { displayedZoneDragPolygon } from './displayedZoneDragPolygon';
import { ZoneRotationHandle } from './ZoneRotationHandle';
import { useLayoutEffect, useMemo, useRef } from "react";
import { ZoneVisual } from "./ZoneVisual";
import { ZoneResizeHandles } from "./ZoneResizeHandles";
import type { ZoneLayerProps } from "./zoneLayerTypes";

type Handlers = Pick<ZoneLayerProps, "onResizeHandleDrag" | "onResizeHandleDragEnd" |
  "onResizeHandleMouseDown" | "onZoneMotionComplete">;

export function ZoneLayer(props: ZoneLayerProps) {
  const player = usePlayerAudience();
  const namePreview = useSelector((state: RootState) => state.interaction.namePreview);
  const colorPreviewZoneId = useSelector((state: RootState) => state.interaction.zoneColorPreview?.zoneId);
  // Memoized visuals need stable callbacks that still see the current gesture.
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; });
  const handlers = useMemo<Handlers>(() => ({
    onResizeHandleDrag: (point, gestureId, timeStamp) => latest.current.onResizeHandleDrag(point, gestureId, timeStamp),
    onResizeHandleDragEnd: (event, gestureId) => latest.current.onResizeHandleDragEnd(event, gestureId),
    onResizeHandleMouseDown: (...args) => latest.current.onResizeHandleMouseDown(...args),
    onZoneMotionComplete: () => { if (!player && latest.current.zoneDrag?.phase === "committed") latest.current.onZoneMotionComplete(); }
  }), [player]);

  const zones = props.encounter.zones.allIds.map(zoneId => {
    const committed = props.encounter.zones.byId[zoneId];
    if (!committed) return null;
    const name = previewedName(namePreview, props.encounter.id, 'zone', zoneId, committed.name);
    const zone = name === committed.name ? committed : { ...committed, name };
    const zoneDrag = props.zoneDrag?.zoneId === zoneId ? props.zoneDrag : null;
    const previewingOpacity = props.zoneOpacityPreview?.zoneId === zoneId;
    return <ZoneVisual key={zoneId} {...handlers}
      zone={props.rotationPreview?.zoneId === zoneId ? { ...zone, rotation: props.rotationPreview.rotation } : zone}
      encounter={zone.showSectionDividers && zone.layoutStrategy.startsWith("SPLIT") ? props.encounter : undefined}
      polygon={zoneDrag?.phase === "dragging" ? zoneDrag.originalPolygon : props.getDisplayedPolygon(zone)}
      zoneDrag={zoneDrag}
      selected={!player && props.selection.selectedEntityType === "zone" && props.selection.selectedIds.includes(zoneId)}
      actorTargeted={!player && props.actorTargetZoneId === zoneId}
      directManipulation={props.directManipulationZoneId === zoneId}
      previewingColor={colorPreviewZoneId === zoneId}
      previewingOpacity={previewingOpacity}
      renderedOpacity={previewingOpacity ? props.zoneOpacityPreview!.opacity : zone.opacity}
      backgroundLuminance={props.backgroundLuminanceByZoneId[zoneId]}
    />;
  });
  return <>{zones}{!player && props.activeToolId === 'zone' && props.selection.selectedEntityType === 'zone'
    ? props.selection.selectedIds.map(zoneId => {
      const zone = props.encounter.zones.byId[zoneId];
      if (!zone) return null;
      const zoneDrag = props.zoneDrag?.zoneId === zoneId ? props.zoneDrag : null;
      const preview = props.rotationPreview?.zoneId === zoneId ? props.rotationPreview : undefined;
      const displayedZone = preview ? { ...zone, rotation: preview.rotation } : zone;
      const polygon = zoneDrag?.phase === 'dragging' ? zoneDrag.originalPolygon : props.getDisplayedPolygon(zone);
      return <g key={zoneId}><ZoneResizeHandles {...handlers} zone={displayedZone} zoneDrag={zoneDrag}
        polygon={zoneDrag?.phase === 'dragging' ? zoneDrag.originalPolygon : props.getDisplayedPolygon(zone)}
        direct={props.directManipulationZoneId === zoneId} />
        <ZoneRotationHandle {...handlers} zone={displayedZone} polygon={displayedZoneDragPolygon(polygon, zoneDrag)} direct={props.directManipulationZoneId === zoneId} active={preview?.active ?? false}
          onZoneRotationCancel={props.onZoneRotationCancel} /></g>;
    }) : null}</>;
}
