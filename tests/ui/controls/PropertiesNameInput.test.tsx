import { fireEvent, render, screen } from '@testing-library/react';
import { PropertiesNameInput } from '@ui/controls/PropertiesNameInput';

it('restores the committed value on Escape and does not commit it on a later blur', () => {
  const onCommit = vi.fn(); render(<PropertiesNameInput aria-label="Name" committedValue="Original" onCommit={onCommit} />);
  const input = screen.getByRole('textbox', { name: 'Name' });
  fireEvent.change(input, { target: { value: 'Uncommitted' } }); fireEvent.keyDown(input, { key: 'Escape' });
  expect(input).toHaveValue('Original'); fireEvent.blur(input); expect(onCommit).not.toHaveBeenCalled();
});
it('commits on blur and follows external name changes such as undo/redo', () => {
  const onCommit = vi.fn(); const { rerender } = render(<PropertiesNameInput aria-label="Name" committedValue="Original" onCommit={onCommit} />);
  const input = screen.getByRole('textbox', { name: 'Name' });
  fireEvent.change(input, { target: { value: ' Accepted ' } }); fireEvent.blur(input); expect(onCommit).toHaveBeenCalledWith('Accepted');
  rerender(<PropertiesNameInput aria-label="Name" committedValue="Accepted" onCommit={onCommit} />); expect(input).toHaveValue('Accepted');
  fireEvent.change(input, { target: { value: 'New typing' } }); rerender(<PropertiesNameInput aria-label="Name" committedValue="Original" onCommit={onCommit} />); expect(input).toHaveValue('Original');
});
