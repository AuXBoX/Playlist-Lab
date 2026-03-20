import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditTemplateModal } from './EditTemplateModal';

describe('EditTemplateModal - Success/Error Messages', () => {
  const mockTemplate = {
    id: 1,
    name: 'Test Template',
    description: 'Test description',
    mix_type: 'genre',
    configuration: {
      mixType: 'genre' as const,
      trackCount: 50,
      sortBy: 'random' as const,
      genres: ['Rock', 'Pop'],
    },
    created_at: Date.now(),
    updated_at: Date.now(),
    use_count: 5,
  };

  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Messages', () => {
    it('displays error message when save fails with Error object', async () => {
      mockOnSave.mockRejectedValue(new Error('Network error'));

      render(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={false}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Error should persist until user takes action
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('displays generic error message when save fails without Error object', async () => {
      mockOnSave.mockRejectedValue('Something went wrong');

      render(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={false}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to update template')).toBeInTheDocument();
      });
    });

    it('clears error message when user makes changes', async () => {
      mockOnSave.mockRejectedValue(new Error('Network error'));

      render(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={false}
        />
      );

      // Trigger error
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Make a change - error should clear
      const nameInput = screen.getByDisplayValue('Test Template');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

      await waitFor(() => {
        expect(screen.queryByText('Network error')).not.toBeInTheDocument();
      });
    });

    it('disables save button when validation errors exist', async () => {
      render(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={false}
        />
      );

      // Clear the name to trigger validation error
      const nameInput = screen.getByDisplayValue('Test Template');
      fireEvent.change(nameInput, { target: { value: '' } });
      fireEvent.blur(nameInput);

      await waitFor(() => {
        // Validation error should be shown
        expect(screen.getByText('Template name is required')).toBeInTheDocument();
        
        // Save button should be disabled
        const saveButton = screen.getByText('Save Changes');
        expect(saveButton).toBeDisabled();
      });

      // onSave should not be called even if button is clicked
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('displays error message with proper styling', async () => {
      mockOnSave.mockRejectedValue(new Error('Test error'));

      render(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={false}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        const errorElement = screen.getByText('Test error');
        expect(errorElement).toHaveClass('edit-template-error');
      });
    });
  });

  describe('Success Flow', () => {
    it('closes modal on successful save (parent handles success message)', async () => {
      mockOnSave.mockResolvedValue(undefined);

      render(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={false}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });

      // Modal should not show any error
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      
      // Note: The parent component (GenerateMixesPage) is responsible for:
      // 1. Closing the modal (calling onClose)
      // 2. Showing the success message
      // 3. Auto-dismissing the success message after 3 seconds
    });

    it('passes correct data to onSave', async () => {
      mockOnSave.mockResolvedValue(undefined);

      render(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={false}
        />
      );

      // Make some changes
      const nameInput = screen.getByDisplayValue('Test Template');
      const descInput = screen.getByDisplayValue('Test description');
      
      fireEvent.change(nameInput, { target: { value: 'Updated Template' } });
      fireEvent.change(descInput, { target: { value: 'Updated description' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          1, // template id
          'Updated Template', // trimmed name
          'Updated description', // trimmed description
          expect.objectContaining({
            mixType: 'genre',
            trackCount: 50,
            genres: ['Rock', 'Pop'],
          })
        );
      });
    });
  });

  describe('User Experience', () => {
    it('disables all controls while saving', () => {
      render(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={true}
        />
      );

      // All inputs should be disabled
      expect(screen.getByDisplayValue('Test Template')).toBeDisabled();
      expect(screen.getByDisplayValue('Test description')).toBeDisabled();
      expect(screen.getByRole('slider')).toBeDisabled();
      
      // Buttons should be disabled
      expect(screen.getByText('Saving...')).toBeDisabled();
      expect(screen.getByText('Cancel')).toBeDisabled();
      expect(screen.getByText('×')).toBeDisabled();
    });

    it('shows appropriate button text while saving', () => {
      const { rerender } = render(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={false}
        />
      );

      expect(screen.getByText('Save Changes')).toBeInTheDocument();

      rerender(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={true}
        />
      );

      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
    });

    it('prevents closing modal while saving', () => {
      render(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={true}
        />
      );

      // Try to close via close button
      const closeButton = screen.getByText('×');
      fireEvent.click(closeButton);
      expect(mockOnClose).not.toHaveBeenCalled();

      // Try to close via cancel button
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('saves on Ctrl+S when form is valid', async () => {
      mockOnSave.mockResolvedValue(undefined);

      render(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={false}
        />
      );

      // Trigger Ctrl+S
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });
    });

    it('does not save on Ctrl+S when form is invalid', async () => {
      render(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={false}
        />
      );

      // Make form invalid
      const nameInput = screen.getByDisplayValue('Test Template');
      fireEvent.change(nameInput, { target: { value: '' } });

      // Trigger Ctrl+S
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });

      await waitFor(() => {
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });

    it('closes on Escape key', () => {
      render(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={false}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('does not close on Escape while saving', () => {
      render(
        <EditTemplateModal
          template={mockTemplate}
          onClose={mockOnClose}
          onSave={mockOnSave}
          isSaving={true}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
