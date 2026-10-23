import { previewedName } from '@interaction/namePreviewState';
import { setRulerPropertiesTarget, setRulerAppearancePreview } from '@interaction/interactionState';
import { coneAngleHandle } from '@core/measurement/coneAngleHandle';
import { RulerActorGlow } from './RulerActorGlow';
import type { ActorRenderPlacement } from '@ui/canvas/actors/actorCanvasLayout';
import type { ActorDragState } from '@ui/canvas/canvasInteractionTypes';
import type { ActorPlacementTranslation } from '@ui/canvas/actors/actorPlacementTranslation';
import { motion } from 'motion/react';
import { useMotionPreference } from '@ui/motion_preferences/MotionPreferenceProvider';
import { useRulerArtifactInput } from './useRulerArtifactInput';
import { RULER_PREVIEW_SPRING } from './RulerPreviewPolyline';
import { isSquareTopology } from '@core/movement/gridProjection';
import { useRulerShortcuts } from './useRulerShortcuts';
import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { EncounterState } from '@core/encounter/types';
import type { RootState } from '@store/store';
import { selectRulerDraft, selectRulerOptions, selectLockedRulers } from '@interaction/rulerState';
import { useMovementPreferences } from '@ui/combat_preferences/useMovementPreferences';
import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import { RulerGraphic, rulerMarker } from './RulerGraphic';
import { useRulerInteraction } from './useRulerInteraction';
import { RulerContextWheel } from './RulerContextWheel';

/** Locked artifacts stay in the overlay layer across tools; only editable points accept drags. */
export function RulerOverlay({ encounter, hitTarget, placements = [], actorDrag, zoneActorTranslation }: {
  encounter: EncounterState; hitTarget?: SVGGElement | null; placements?: ActorRenderPlacement[];
  actorDrag?: ActorDragState | null; zoneActorTranslation?: ActorPlacementTranslation | null;
}) {
  const dispatch = useDispatch();
  const { animationsDisabled } = useMotionPreference();
  const options = useSelector(selectRulerOptions), draft = useSelector(selectRulerDraft);
  const { activeToolId, editingRuler, namePreview, rulerAppearancePreview: appearancePreview } = useSelector((state: RootState) => state.interaction);
  const lockedRulers = useSelector(selectLockedRulers);
  const editingRulerId = editingRuler?.id ?? null;
  const active = activeToolId === 'ruler', { preferences } = useMovementPreferences();
  const { preferences: canvas } = useCanvasPreferences();
  useRulerShortcuts(active, options, isSquareTopology(encounter.grid.type));
  const interaction = useRulerInteraction({ encounter, active, options, draft, editingId: editingRulerId });
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const close = useCallback(() => { setMenu(null); dispatch(setRulerAppearancePreview(null)); }, [dispatch]);
  useEffect(() => { if (!active) close(); }, [active, close]);
  const openMenu = (position: { id: string; x: number; y: number }) => {
    if (!active) return;
    if (draft) { interaction.pickUpLastPoint(); close(); }
    else { dispatch(setRulerPropertiesTarget(position.id)); setMenu(position); }
  };
  const artifactInput = useRulerArtifactInput({ active, place: interaction.canvas.onPointerDown, preview: interaction.canvas.onPointerMove, openMenu });
  const points = draft?.points ?? [];
  const flexible = canvas.rulerFeel === 'flexible' && !animationsDisabled && !interaction.directManipulation;
  const cursor = draft && !draft.complete && interaction.hover ? rulerMarker(encounter, interaction.hover, points.length, options) : null;
  const preview = draft && !draft.complete && interaction.hover ? [...points, interaction.hover] : points;
  const angleHandle = coneAngleHandle(encounter, points, options);
  const editing = editingRuler, menuRuler = lockedRulers.find(r => r.id === menu?.id);
  const appearance = (color: string | null, opacity: number | null) => ({ color: color ?? canvas.rulerColor ?? undefined, opacity: opacity ?? canvas.rulerOpacity });
  if (!active && !lockedRulers.length) return null;
  return <>
    <g aria-label="Ruler measurement" className="text-canvas-ink">
      {active ? <rect aria-label="Ruler drawing surface" width={encounter.canvasSize.width} height={encounter.canvasSize.height} fill="transparent" style={{ touchAction: 'none' }} className="cursor-crosshair"
        {...interaction.canvas} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} /> : null}
      {lockedRulers.filter(ruler => ruler.id !== editingRulerId).map(ruler => <g key={ruler.id} data-ruler-id={ruler.id} style={appearancePreview?.encounterId === encounter.id && appearancePreview.id === ruler.id
        ? appearance(appearancePreview.color, appearancePreview.opacity) : appearance(ruler.color, ruler.opacity)}
        {...artifactInput(ruler.id)}>
        <RulerGraphic encounter={encounter} points={ruler.points} options={ruler.options} policy={preferences.diagonalCost} name={previewedName(namePreview, encounter.id, 'ruler', ruler.id, ruler.name)} hitTarget={active ? undefined : hitTarget}
          renderUnderlay={area => <RulerActorGlow encounter={encounter} points={ruler.points} options={ruler.options} policy={preferences.diagonalCost} area={area}
            coverage={canvas.rulerCellCoverage} placements={placements} drag={actorDrag} translation={zoneActorTranslation} projectTokens={canvas.projectIsometricTokens} intensity={canvas.rulerActorHighlightIntensity} />}
          onContextMenu={active ? event => {
            if (active && draft) { interaction.canvas.onContextMenu(event); close(); }
            else { event.preventDefault(); event.stopPropagation(); openMenu({ id: ruler.id, x: event.clientX, y: event.clientY }); }
          } : undefined} />
      </g>)}
      {active && draft ? <g style={appearancePreview?.encounterId === encounter.id && appearancePreview.id === editing?.id ? appearance(appearancePreview.color, appearancePreview.opacity) : appearance(editing?.color ?? null, editing?.opacity ?? null)}>
        <RulerGraphic encounter={encounter} points={preview} options={options} policy={preferences.diagonalCost} name={editing ? previewedName(namePreview, encounter.id, 'ruler', editing.id, editing.name) : undefined} flexible={flexible}
          renderUnderlay={area => <RulerActorGlow encounter={encounter} points={preview} options={options} policy={preferences.diagonalCost} area={area}
            coverage={canvas.rulerCellCoverage} placements={placements} drag={actorDrag} translation={zoneActorTranslation} projectTokens={canvas.projectIsometricTokens} intensity={canvas.rulerActorHighlightIntensity} />}>
          {points.map((p, index) => { const point = rulerMarker(encounter, p, index, options, preview.at(-1)); return <circle key={index} aria-label={`Ruler point ${index + 1}`} cx={point.x} cy={point.y} r={6}
            className="touch-none cursor-grab active:cursor-grabbing fill-current hover:fill-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink" tabIndex={0} role="button"
            {...interaction.pointHandlers(editingRulerId, index)} />; })}
          {angleHandle ? <circle aria-label="Cone angle handle" cx={angleHandle.point.x} cy={angleHandle.point.y} r={6}
            data-touch-tooltip-label="Drag to adjust cone angle" role="button" tabIndex={0}
            className="touch-none cursor-grab active:cursor-grabbing fill-current hover:fill-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink"
            {...interaction.coneAngleHandlers(editingRulerId)}><title>Drag to adjust cone angle</title></circle> : null}
          {cursor ? <motion.circle aria-label="Ruler preview point" initial={false} animate={{ cx: cursor.x, cy: cursor.y }}
            transition={flexible ? RULER_PREVIEW_SPRING : { duration: 0 }} r={6} fill="#ffffff" pointerEvents="none" /> : null}
        </RulerGraphic>
      </g> : null}
    </g>
    {active && menu && menuRuler ? <RulerContextWheel key={menu.id} ruler={menuRuler} x={menu.x} y={menu.y} onClose={close} onAppearancePreview={value => dispatch(setRulerAppearancePreview({ ...value, id: menu.id, encounterId: encounter.id }))} /> : null}
  </>;
}
