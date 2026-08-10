import type { DragEvent } from 'react';

import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import type { AppDispatch } from '@store/store';
import type { RootState } from '@store/store';
import {
  ACTOR_CREATION_DRAG_TYPE,
  type NewActorDragData
} from '../../toolbar/actor/actorCreationDrag';
import { getDroppedImageFile } from '../../toolbar/background/readImageFile';
import {
  hasExternalFiles,
  LIBRARY_NODE_DRAG_TYPE
} from '../../library/libraryDrag';
import { findZoneIdAtPoint } from '../actors/actorCanvasLayout';
import {
  commitActorFromCreation,
  commitActorFromImage,
  commitActorFromLibraryNode,
  commitBackgroundFromFile,
  getMovableActorIds,
  moveActorsToZone
} from '../canvasDropMutations';
import {
  hasZonelessActorDrag,
  readZonelessActorIds
} from '../../panels/zoneless_actors/zonelessActorDrag';
import { toSvgPoint } from '../zones/zoneGeometry';
import { useCanvasViewport } from '../CanvasViewportContext';

type UseCanvasDropHandlersInput = {
  activeToolId: RootState['interaction']['activeToolId'];
  actorTool: RootState['interaction']['actorTool'];
  dispatch: AppDispatch;
  encounter: RootState['encounter']['present'];
  library: RootState['library'];
};

export function useCanvasDropHandlers({
  activeToolId,
  actorTool,
  dispatch,
  encounter,
  library
}: UseCanvasDropHandlersInput) {
  const { getViewportSize, zoom: viewportZoom } = useCanvasViewport();
  const mutationContext = {
    actorTool,
    dispatch,
    encounter,
    library
  };

  function handleActorCreationDropToZoneless(event: DragEvent<HTMLElement>) {
    if (activeToolId !== 'actor') {
      return;
    }

    const actorCreationData = event.dataTransfer.getData(
      ACTOR_CREATION_DRAG_TYPE
    );

    if (!actorCreationData) {
      return;
    }

    event.preventDefault();

    try {
      commitActorFromCreation(
        mutationContext,
        JSON.parse(actorCreationData) as NewActorDragData,
        ZONELESS_ACTOR_ZONE_ID
      );
    } catch {
      // Ignore malformed external drag payloads.
    }
  }

  function handleActorCreationDragOverZoneless(event: DragEvent<HTMLElement>) {
    if (
      activeToolId !== 'actor' ||
      !Array.from(event.dataTransfer.types).includes(ACTOR_CREATION_DRAG_TYPE)
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleCanvasDragOver(event: DragEvent<SVGSVGElement>) {
    const externalFiles = hasExternalFiles(event);

    if (
      externalFiles &&
      (activeToolId === 'background' || activeToolId === 'actor')
    ) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      return;
    }

    if (activeToolId !== 'actor' && activeToolId !== 'select') {
      return;
    }

    const libraryDrag = Array.from(event.dataTransfer.types).includes(
      LIBRARY_NODE_DRAG_TYPE
    );
    const actorCreationDrag = Array.from(event.dataTransfer.types).includes(
      ACTOR_CREATION_DRAG_TYPE
    );
    const zonelessActorDrag = hasZonelessActorDrag(event);
    // Some browsers expose the standard drag type during dragover but keep
    // its value protected until drop. Treat it as a provisional canvas drag
    // target; the drop handler still validates the namespaced actor payload.
    const standardTextDrag = Array.from(event.dataTransfer.types).includes(
      'text/plain'
    );

    if (
      !zonelessActorDrag &&
      !standardTextDrag &&
      (activeToolId !== 'actor' || (!libraryDrag && !actorCreationDrag))
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect =
      (libraryDrag || actorCreationDrag) && activeToolId === 'actor'
        ? 'copy'
        : 'move';
  }

  function handleCanvasDrop(event: DragEvent<SVGSVGElement>) {
    const externalFiles = hasExternalFiles(event);
    const droppedImageFile = getDroppedImageFile(event.dataTransfer);

    if (activeToolId === 'background' && externalFiles) {
      event.preventDefault();
      if (droppedImageFile) {
        void commitBackgroundFromFile(
          mutationContext,
          droppedImageFile,
          getViewportSize,
          viewportZoom
        );
      }
      return;
    }

    if (activeToolId !== 'actor' && activeToolId !== 'select') {
      return;
    }

    const point = toSvgPoint(event, event.currentTarget);
    const destinationZoneId = findZoneIdAtPoint(encounter, point);

    if (hasZonelessActorDrag(event)) {
      event.preventDefault();

      if (!destinationZoneId) {
        return;
      }

      const actorIds = readZonelessActorIds(event).filter(
        (actorId) =>
          encounter.actors.byId[actorId]?.currentZoneId ===
          ZONELESS_ACTOR_ZONE_ID
      );

      if (actorIds.length > 0) {
        moveActorsToZone(
          mutationContext,
          actorIds,
          destinationZoneId,
          false,
          point
        );
      }
      return;
    }

    if (activeToolId !== 'actor') {
      return;
    }

    if (externalFiles) {
      event.preventDefault();
      if (droppedImageFile) {
        void commitActorFromImage(
          mutationContext,
          droppedImageFile,
          destinationZoneId ?? ZONELESS_ACTOR_ZONE_ID,
          point
        );
      }
      return;
    }

    const destination = destinationZoneId ?? ZONELESS_ACTOR_ZONE_ID;
    const actorCreationData = event.dataTransfer.getData(
      ACTOR_CREATION_DRAG_TYPE
    );

    if (actorCreationData) {
      event.preventDefault();
      try {
        commitActorFromCreation(
          mutationContext,
          JSON.parse(actorCreationData) as NewActorDragData,
          destination,
          point
        );
      } catch {
        return;
      }
      return;
    }

    const nodeId = event.dataTransfer.getData(LIBRARY_NODE_DRAG_TYPE);
    if (!nodeId) {
      return;
    }

    event.preventDefault();
    commitActorFromLibraryNode(mutationContext, nodeId, destination, point);
  }

  return {
    handleActorCreationDragOverZoneless,
    handleActorCreationDropToZoneless,
    handleCanvasDragOver,
    handleCanvasDrop
  };
}
