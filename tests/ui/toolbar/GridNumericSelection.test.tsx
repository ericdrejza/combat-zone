import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createDefaultGrid } from '@core/movement/types';
import { GridSettingsFields } from '@ui/toolbar/grid/GridSettingsFields';

function Harness() {
  const [grid, setGrid] = useState({ ...createDefaultGrid(), type: 'isometric' as const });
  return <GridSettingsFields draft={grid} setDraft={next => setGrid({ ...next, type: 'isometric' })} />;
}

it.each(['Cell size', 'Rotation (degrees)', 'Origin X', 'Origin Y', 'Distance per cell', 'Isometric angle (degrees)'])(
  'replaces the selected %s value when typing after a click', async label => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByRole('spinbutton', { name: label });
    await user.click(field);
    await user.keyboard('32');
    expect(field).toHaveValue(32);
    await user.tab();
    expect(field).toHaveValue(32);
    // Clicking an already focused field also makes the next edit a replacement.
    await user.click(field);
    await user.keyboard('12');
    expect(field).toHaveValue(12);
  }
);
