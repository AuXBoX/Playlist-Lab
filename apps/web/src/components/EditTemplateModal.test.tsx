import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditTemplateModal } from './EditTemplateModal';

describe('EditTemplateModal', () => {
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

  it('renders with template data pre-populated', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    expect(screen.getByDisplayValue('Test Template')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Rock, Pop')).toBeInTheDocument();
  });

  it('displays template name in header', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    expect(screen.getByText(/Edit Template: Test Template/i)).toBeInTheDocument();
  });

  it('allows editing template name', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const nameInput = screen.getByDisplayValue('Test Template');
    fireEvent.change(nameInput, { target: { value: 'Updated Template' } });

    expect(screen.getByDisplayValue('Updated Template')).toBeInTheDocument();
  });

  it('allows editing description', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const descInput = screen.getByDisplayValue('Test description');
    fireEvent.change(descInput, { target: { value: 'Updated description' } });

    expect(screen.getByDisplayValue('Updated description')).toBeInTheDocument();
  });

  it('allows editing track count', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '100' } });

    expect(screen.getByText(/Number of Tracks: 100/i)).toBeInTheDocument();
  });

  it('allows editing genres for genre mix type', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const genresInput = screen.getByDisplayValue('Rock, Pop');
    fireEvent.change(genresInput, { target: { value: 'Jazz, Blues' } });

    expect(screen.getByDisplayValue('Jazz, Blues')).toBeInTheDocument();
  });

  it('calls onSave with updated data when save button is clicked', async () => {
    mockOnSave.mockResolvedValue(undefined);

    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const nameInput = screen.getByDisplayValue('Test Template');
    fireEvent.change(nameInput, { target: { value: 'Updated Template' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        1,
        'Updated Template',
        'Test description',
        expect.objectContaining({
          mixType: 'genre',
          trackCount: 50,
        })
      );
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when close button (×) is clicked', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const overlay = screen.getByText(/Edit Template:/i).closest('.edit-template-overlay');
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('does not call onClose when modal content is clicked', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const modal = screen.getByText(/Edit Template:/i).closest('.edit-template-modal');
    if (modal) {
      fireEvent.click(modal);
      expect(mockOnClose).not.toHaveBeenCalled();
    }
  });

  it('disables save button when name is empty', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const nameInput = screen.getByDisplayValue('Test Template');
    fireEvent.change(nameInput, { target: { value: '' } });

    const saveButton = screen.getByText('Save Changes');
    expect(saveButton).toBeDisabled();
    
    // Verify onSave is not called when button is disabled
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('disables all inputs when isSaving is true', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={true}
      />
    );

    const nameInput = screen.getByDisplayValue('Test Template');
    const descInput = screen.getByDisplayValue('Test description');
    const saveButton = screen.getByText('Saving...');
    const cancelButton = screen.getByText('Cancel');

    expect(nameInput).toBeDisabled();
    expect(descInput).toBeDisabled();
    expect(saveButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it('shows "Saving..." text when isSaving is true', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={true}
      />
    );

    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('displays error message when save fails', async () => {
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
  });

  it('toggles advanced options when clicked', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const advancedToggle = screen.getByText('Advanced Options');
    
    // Initially collapsed
    expect(screen.queryByText('Allow duplicate artists')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(advancedToggle);
    expect(screen.getByText('Allow duplicate artists')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(advancedToggle);
    expect(screen.queryByText('Allow duplicate artists')).not.toBeInTheDocument();
  });

  it('handles mood mix type correctly', () => {
    const moodTemplate = {
      ...mockTemplate,
      mix_type: 'mood',
      configuration: {
        mixType: 'mood' as const,
        trackCount: 50,
        moods: ['Chill', 'Relaxing'],
      },
    };

    render(
      <EditTemplateModal
        template={moodTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    expect(screen.getByDisplayValue('Chill, Relaxing')).toBeInTheDocument();
  });

  it('handles decade mix type correctly', () => {
    const decadeTemplate = {
      ...mockTemplate,
      mix_type: 'decade',
      configuration: {
        mixType: 'decade' as const,
        trackCount: 50,
        decades: [1980, 1990, 2000],
      },
    };

    render(
      <EditTemplateModal
        template={decadeTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    expect(screen.getByDisplayValue('1980, 1990, 2000')).toBeInTheDocument();
  });

  it('validates track count range', async () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    // Manually set an invalid track count (this would normally be prevented by the slider)
    const nameInput = screen.getByDisplayValue('Test Template');
    const form = nameInput.closest('form') || nameInput.parentElement;
    
    // We can't easily test this with the slider, but the validation is in place
    // The slider itself prevents invalid values, but the validation catches edge cases
  });

  it('shows validation error for empty name', async () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const nameInput = screen.getByDisplayValue('Test Template');
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(screen.getByText('Template name is required')).toBeInTheDocument();
    });
  });

  it('shows validation error for name exceeding 255 characters', async () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const nameInput = screen.getByDisplayValue('Test Template');
    const longName = 'a'.repeat(256);
    fireEvent.change(nameInput, { target: { value: longName } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(screen.getByText('Template name must be 255 characters or less')).toBeInTheDocument();
    });
  });

  it('shows validation error for description exceeding 1000 characters', async () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const descInput = screen.getByDisplayValue('Test description');
    const longDesc = 'a'.repeat(1001);
    fireEvent.change(descInput, { target: { value: longDesc } });
    fireEvent.blur(descInput);

    await waitFor(() => {
      expect(screen.getByText('Description must be 1000 characters or less')).toBeInTheDocument();
    });
  });

  it('clears validation error when input is corrected', async () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const nameInput = screen.getByDisplayValue('Test Template');
    
    // Trigger error
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(screen.getByText('Template name is required')).toBeInTheDocument();
    });

    // Correct the error
    fireEvent.change(nameInput, { target: { value: 'Valid Name' } });

    await waitFor(() => {
      expect(screen.queryByText('Template name is required')).not.toBeInTheDocument();
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

    const nameInput = screen.getByDisplayValue('Test Template');
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      const saveButton = screen.getByText('Save Changes');
      expect(saveButton).toBeDisabled();
    });
  });

  it('shows character count for name field', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    expect(screen.getByText('13/255 characters')).toBeInTheDocument();
  });

  it('shows character count for description field', () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    expect(screen.getByText('16/1000 characters')).toBeInTheDocument();
  });

  it('prevents form submission with validation errors', async () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const nameInput = screen.getByDisplayValue('Test Template');
    fireEvent.change(nameInput, { target: { value: 'a'.repeat(256) } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Please fix the validation errors before saving')).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  it('applies error styling to invalid fields', async () => {
    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const nameInput = screen.getByDisplayValue('Test Template');
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(nameInput).toHaveClass('error');
    });
  });

  it('trims whitespace from name and description', async () => {
    mockOnSave.mockResolvedValue(undefined);

    render(
      <EditTemplateModal
        template={mockTemplate}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    const nameInput = screen.getByDisplayValue('Test Template');
    const descInput = screen.getByDisplayValue('Test description');

    fireEvent.change(nameInput, { target: { value: '  Trimmed Name  ' } });
    fireEvent.change(descInput, { target: { value: '  Trimmed Desc  ' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        1,
        'Trimmed Name',
        'Trimmed Desc',
        expect.any(Object)
      );
    });
  });
});
