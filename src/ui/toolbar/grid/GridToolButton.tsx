import { createPortal } from 'react-dom';
import type { ToolId } from '@interaction/tools/toolRegistry';
import { TOOL_DEFINITIONS_BY_ID } from '@interaction/tools/toolRegistry';
import { ToolButton } from '../ToolButton';
import { ToolbarOptionRow, ToolbarSubtoolBar } from '../ToolbarOption';
import { GridControls } from './GridControls';

export function GridToolButton({ activeToolId, compactLayout, compactSubtoolHost }: {
  activeToolId: ToolId | null; compactLayout: boolean; compactSubtoolHost: HTMLDivElement | null;
}) {
  const options = activeToolId === 'grid' ? <ToolbarSubtoolBar aria-label="Grid options"><GridControls /></ToolbarSubtoolBar> : null;
  return <><ToolbarOptionRow className="max-lg:contents"><ToolButton activeToolId={activeToolId} tool={TOOL_DEFINITIONS_BY_ID.grid} />{!compactLayout ? options : null}</ToolbarOptionRow>
    {compactLayout && compactSubtoolHost && options ? createPortal(options, compactSubtoolHost) : null}</>;
}
