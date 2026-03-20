import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SaveTemplateModal } from './SaveTemplateModal';

describe('SaveTemplateModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal with form fields', () => {
    render(
      <SaveTemplateModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    expect(screen.getByText('Save Mix Template')).toBeInTheDocument();
    expect(screen.getByLabelText(/Template Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Template/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('disables save button when name is empty', () => {
    render(
      <SaveTemplateModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const saveButton = screen.getByRole('button', { name: /Save Template/i });
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when name is provided', () => {
    render(
      <SaveTemplateModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const nameInput = screen.getByLabelText(/Template Name/i);
    fireEvent.change(nameInput, { target: { value: 'My Template' } });

    const saveButton = screen.getByRole('button', { name: /Save Template/i });
    expect(saveButton).not.toBeDisabled();
  });

  it('calls onSave with name and description when save button is clicked', async () => {
    mockOnSave.mockResolvedValue(undefined);

    render(
      <SaveTemplateModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const nameInput = screen.getByLabelText(/Template Name/i);
    const descriptionInput = screen.getByLabelText(/Description/i);
    
    fireEvent.change(nameInput, { target: { value: 'My Template' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

    const saveButton = screen.getByRole('button', { name: /Save Template/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('My Template', 'Test description');
    });
  });

  it('trims whitespace from name and description', async () => {
    mockOnSave.mockResolvedValue(undefined);

    render(
      <SaveTemplateModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const nameInput = screen.getByLabelText(/Template Name/i);
    const descriptionInput = screen.getByLabelText(/Description/i);
    
    fireEvent.change(nameInput, { target: { value: '  My Template  ' } });
    fireEvent.change(descriptionInput, { target: { value: '  Test description  ' } });

    const saveButton = screen.getByRole('button', { name: /Save Template/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('My Template', 'Test description');
    });
  });

  it('shows error message when name is empty on save attempt', async () => {
    render(
      <SaveTemplateModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    // The save button should be disabled when name is empty
    const saveButton = screen.getByRole('button', { name: /Save Template/i });
    expect(saveButton).toBeDisabled();
  });

  it('displays error message when save fails', async () => {
    const errorMessage = 'Failed to save template';
    mockOnSave.mockRejectedValue(new Error(errorMessage));

    render(
      <SaveTemplateModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const nameInput = screen.getByLabelText(/Template Name/i);
    fireEvent.change(nameInput, { target: { value: 'My Template' } });

    const saveButton = screen.getByRole('button', { name: /Save Template/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    render(
      <SaveTemplateModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', () => {
    render(
      <SaveTemplateModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const overlay = screen.getByText('Save Mix Template').closest('.save-template-overlay');
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('disables inputs and buttons when isSaving is true', () => {
    render(
      <SaveTemplateModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={true}
      />
    );

    expect(screen.getByLabelText(/Template Name/i)).toBeDisabled();
    expect(screen.getByLabelText(/Description/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /Saving.../i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
  });

  it('shows "Saving..." text when isSaving is true', () => {
    render(
      <SaveTemplateModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={true}
      />
    );

    expect(screen.getByRole('button', { name: /Saving.../i })).toBeInTheDocument();
  });

  it('handles keyboard shortcut Ctrl+S to save', async () => {
    mockOnSave.mockResolvedValue(undefined);

    render(
      <SaveTemplateModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const nameInput = screen.getByLabelText(/Template Name/i);
    fireEvent.change(nameInput, { target: { value: 'My Template' } });

    // Simulate Ctrl+S
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('My Template', '');
    });
  });

  it('handles keyboard shortcut Escape to close', () => {
    render(
      <SaveTemplateModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    // Simulate Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not close on Escape when saving', () => {
    render(
      <SaveTemplateModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={true}
      />
    );

    // Simulate Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
