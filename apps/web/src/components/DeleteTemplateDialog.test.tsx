import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteTemplateDialog } from './DeleteTemplateDialog';

describe('DeleteTemplateDialog', () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();
  const templateName = 'Test Template';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders with template name', () => {
    render(
      <DeleteTemplateDialog
        templateName={templateName}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={false}
      />
    );

    expect(screen.getByText('Delete Template?')).toBeInTheDocument();
    expect(screen.getByText(/Test Template/)).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('calls onConfirm when Delete button is clicked', () => {
    render(
      <DeleteTemplateDialog
        templateName={templateName}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={false}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel button is clicked', () => {
    render(
      <DeleteTemplateDialog
        templateName={templateName}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={false}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when clicking overlay', () => {
    render(
      <DeleteTemplateDialog
        templateName={templateName}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={false}
      />
    );

    const overlay = document.querySelector('.delete-dialog-overlay');
    if (overlay) {
      fireEvent.click(overlay);
    }

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel when clicking modal content', () => {
    render(
      <DeleteTemplateDialog
        templateName={templateName}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={false}
      />
    );

    const modal = document.querySelector('.delete-dialog-modal');
    if (modal) {
      fireEvent.click(modal);
    }

    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('disables buttons when isDeleting is true', () => {
    render(
      <DeleteTemplateDialog
        templateName={templateName}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={true}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /deleting/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    expect(deleteButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it('shows "Deleting..." text when isDeleting is true', () => {
    render(
      <DeleteTemplateDialog
        templateName={templateName}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={true}
      />
    );

    expect(screen.getByText('Deleting...')).toBeInTheDocument();
  });

  it('calls onConfirm when Enter key is pressed', () => {
    render(
      <DeleteTemplateDialog
        templateName={templateName}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={false}
      />
    );

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape key is pressed', () => {
    render(
      <DeleteTemplateDialog
        templateName={templateName}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={false}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('does not respond to keyboard shortcuts when isDeleting is true', () => {
    render(
      <DeleteTemplateDialog
        templateName={templateName}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={true}
      />
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockOnConfirm).not.toHaveBeenCalled();
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('displays keyboard shortcut hints', () => {
    render(
      <DeleteTemplateDialog
        templateName={templateName}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={false}
      />
    );

    expect(screen.getByText(/Enter/)).toBeInTheDocument();
    expect(screen.getByText(/Esc/)).toBeInTheDocument();
  });

  it('cleans up event listeners on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = render(
      <DeleteTemplateDialog
        templateName={templateName}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={false}
      />
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
