import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TemplateList, type MixTemplate } from './TemplateList';

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

const mockTemplates: MixTemplate[] = [
  {
    id: 1,
    name: 'Chill Evening Mix',
    description: 'Relaxing tracks for evening',
    mixType: 'mood',
    configuration: {
      mixType: 'mood',
      trackCount: 50,
      moods: ['chill', 'relaxing'],
    },
    createdAt: Date.now() / 1000,
    updatedAt: Date.now() / 1000,
    useCount: 5,
  },
  {
    id: 2,
    name: 'Rock Classics',
    description: 'Best rock songs',
    mixType: 'genre',
    configuration: {
      mixType: 'genre',
      trackCount: 100,
      genres: ['rock'],
    },
    createdAt: Date.now() / 1000 - 86400,
    updatedAt: Date.now() / 1000 - 86400,
    useCount: 10,
  },
  {
    id: 3,
    name: 'Beatles Collection',
    description: 'All Beatles tracks',
    mixType: 'artist',
    configuration: {
      mixType: 'artist',
      trackCount: 200,
      artistIds: ['123'],
    },
    createdAt: Date.now() / 1000 - 172800,
    updatedAt: Date.now() / 1000 - 172800,
    useCount: 3,
  },
];

describe('TemplateList - Search and Filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ templates: mockTemplates }),
    });
  });

  it('should display all templates initially', async () => {
    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
      expect(screen.getByText('Rock Classics')).toBeInTheDocument();
      expect(screen.getByText('Beatles Collection')).toBeInTheDocument();
    });
  });

  it('should filter templates by search query (case-insensitive)', async () => {
    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'chill' } });

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
      expect(screen.queryByText('Rock Classics')).not.toBeInTheDocument();
      expect(screen.queryByText('Beatles Collection')).not.toBeInTheDocument();
    });
  });

  it('should filter templates by mix type', async () => {
    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const filterSelect = screen.getByDisplayValue('All Types');
    fireEvent.change(filterSelect, { target: { value: 'artist' } });

    await waitFor(() => {
      expect(screen.queryByText('Chill Evening Mix')).not.toBeInTheDocument();
      expect(screen.queryByText('Rock Classics')).not.toBeInTheDocument();
      expect(screen.getByText('Beatles Collection')).toBeInTheDocument();
    });
  });

  it('should combine search and type filter', async () => {
    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    // Set type filter to genre
    const filterSelect = screen.getByDisplayValue('All Types');
    fireEvent.change(filterSelect, { target: { value: 'genre' } });

    // Search for "rock"
    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'rock' } });

    await waitFor(() => {
      expect(screen.queryByText('Chill Evening Mix')).not.toBeInTheDocument();
      expect(screen.getByText('Rock Classics')).toBeInTheDocument();
      expect(screen.queryByText('Beatles Collection')).not.toBeInTheDocument();
    });
  });

  it('should show filtered count when filters are active', async () => {
    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'rock' } });

    await waitFor(() => {
      expect(screen.getByText('Showing 1 of 3 templates')).toBeInTheDocument();
    });
  });

  it('should show clear buttons when filters are active', async () => {
    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No templates match your filters')).toBeInTheDocument();
      expect(screen.getByText('Clear Search')).toBeInTheDocument();
    });
  });

  it('should clear search when clear button is clicked', async () => {
    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('Clear Search')).toBeInTheDocument();
    });

    const clearButton = screen.getByText('Clear Search');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
      expect(screen.getByText('Rock Classics')).toBeInTheDocument();
      expect(screen.getByText('Beatles Collection')).toBeInTheDocument();
    });
  });

  it('should clear type filter when clear button is clicked', async () => {
    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const filterSelect = screen.getByDisplayValue('All Types');
    fireEvent.change(filterSelect, { target: { value: 'custom' } });

    await waitFor(() => {
      expect(screen.getByText('No templates match your filters')).toBeInTheDocument();
      expect(screen.getByText('Clear Filter')).toBeInTheDocument();
    });

    const clearButton = screen.getByText('Clear Filter');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
      expect(screen.getByText('Rock Classics')).toBeInTheDocument();
      expect(screen.getByText('Beatles Collection')).toBeInTheDocument();
    });
  });

  it('should search in template description', async () => {
    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'relaxing' } });

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
      expect(screen.queryByText('Rock Classics')).not.toBeInTheDocument();
    });
  });

  it('should search in mix type', async () => {
    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'mood' } });

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
      expect(screen.queryByText('Rock Classics')).not.toBeInTheDocument();
      expect(screen.queryByText('Beatles Collection')).not.toBeInTheDocument();
    });
  });
});

describe('TemplateList - Loading State', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading spinner and message while fetching templates', async () => {
    // Create a promise that we can control
    let resolvePromise: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    (global.fetch as jest.Mock).mockReturnValue(fetchPromise);

    render(<TemplateList />);

    // Loading state should be visible
    expect(screen.getByText('Loading templates...')).toBeInTheDocument();
    expect(document.querySelector('.loading-spinner')).toBeInTheDocument();

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => ({ templates: mockTemplates }),
    });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading templates...')).not.toBeInTheDocument();
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });
  });

  it('should not show controls during loading', async () => {
    let resolvePromise: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    (global.fetch as jest.Mock).mockReturnValue(fetchPromise);

    render(<TemplateList />);

    // Controls should not be visible during loading
    expect(screen.queryByPlaceholderText('Search templates...')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('All Types')).not.toBeInTheDocument();

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => ({ templates: mockTemplates }),
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search templates...')).toBeInTheDocument();
    });
  });
});

describe('TemplateList - Empty State', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show empty state when no templates exist', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ templates: [] }),
    });

    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('No saved templates yet')).toBeInTheDocument();
      expect(screen.getByText('Create a mix and save it as a template to get started')).toBeInTheDocument();
    });

    // Should not show clear buttons when no templates exist
    expect(screen.queryByText('Clear Search')).not.toBeInTheDocument();
    expect(screen.queryByText('Clear Filter')).not.toBeInTheDocument();
  });

  it('should show filtered empty state with clear buttons', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ templates: mockTemplates }),
    });

    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    // Apply filter that returns no results
    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No templates match your filters')).toBeInTheDocument();
      expect(screen.getByText('Clear Search')).toBeInTheDocument();
    });
  });

  it('should show both clear buttons when both filters are active', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ templates: mockTemplates }),
    });

    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    // Apply both search and type filter
    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    const filterSelect = screen.getByDisplayValue('All Types');
    fireEvent.change(filterSelect, { target: { value: 'custom' } });

    await waitFor(() => {
      expect(screen.getByText('No templates match your filters')).toBeInTheDocument();
      expect(screen.getByText('Clear Search')).toBeInTheDocument();
      expect(screen.getByText('Clear Filter')).toBeInTheDocument();
    });
  });

  it('should not show controls when no templates exist', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ templates: [] }),
    });

    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('No saved templates yet')).toBeInTheDocument();
    });

    // Controls should not be visible
    expect(screen.queryByPlaceholderText('Search templates...')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('All Types')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Recently Used')).not.toBeInTheDocument();
  });
});

describe('TemplateList - Sorting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should sort by recently used by default', async () => {
    const templatesWithUsage = [
      {
        ...mockTemplates[0],
        lastUsedAt: Date.now() / 1000 - 86400, // 1 day ago
      },
      {
        ...mockTemplates[1],
        lastUsedAt: Date.now() / 1000 - 172800, // 2 days ago
      },
      {
        ...mockTemplates[2],
        lastUsedAt: Date.now() / 1000, // Just now
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ templates: templatesWithUsage }),
    });

    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Beatles Collection')).toBeInTheDocument();
    });

    const cards = screen.getAllByRole('heading', { level: 3 });
    expect(cards[0]).toHaveTextContent('Beatles Collection'); // Most recent
    expect(cards[1]).toHaveTextContent('Chill Evening Mix');
    expect(cards[2]).toHaveTextContent('Rock Classics'); // Least recent
  });

  it('should sort by name alphabetically', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ templates: mockTemplates }),
    });

    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const sortSelect = screen.getByDisplayValue('Recently Used');
    fireEvent.change(sortSelect, { target: { value: 'name' } });

    await waitFor(() => {
      const cards = screen.getAllByRole('heading', { level: 3 });
      expect(cards[0]).toHaveTextContent('Beatles Collection'); // A-Z
      expect(cards[1]).toHaveTextContent('Chill Evening Mix');
      expect(cards[2]).toHaveTextContent('Rock Classics');
    });
  });

  it('should sort by most used', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ templates: mockTemplates }),
    });

    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const sortSelect = screen.getByDisplayValue('Recently Used');
    fireEvent.change(sortSelect, { target: { value: 'mostUsed' } });

    await waitFor(() => {
      const cards = screen.getAllByRole('heading', { level: 3 });
      expect(cards[0]).toHaveTextContent('Rock Classics'); // useCount: 10
      expect(cards[1]).toHaveTextContent('Chill Evening Mix'); // useCount: 5
      expect(cards[2]).toHaveTextContent('Beatles Collection'); // useCount: 3
    });
  });

  it('should maintain sort order when filtering', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ templates: mockTemplates }),
    });

    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    // Set sort to name
    const sortSelect = screen.getByDisplayValue('Recently Used');
    fireEvent.change(sortSelect, { target: { value: 'name' } });

    // Apply filter
    const filterSelect = screen.getByDisplayValue('All Types');
    fireEvent.change(filterSelect, { target: { value: 'genre' } });

    await waitFor(() => {
      // Only Rock Classics should be visible (genre type)
      expect(screen.getByText('Rock Classics')).toBeInTheDocument();
      expect(screen.queryByText('Chill Evening Mix')).not.toBeInTheDocument();
      expect(screen.queryByText('Beatles Collection')).not.toBeInTheDocument();
    });
  });

  it('should maintain sort order when searching', async () => {
    const templatesForSearch = [
      {
        ...mockTemplates[0],
        name: 'Rock Mix A',
        mixType: 'genre',
        useCount: 3,
      },
      {
        ...mockTemplates[1],
        name: 'Rock Mix B',
        mixType: 'genre',
        useCount: 10,
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ templates: templatesForSearch }),
    });

    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Rock Mix A')).toBeInTheDocument();
    });

    // Set sort to most used
    const sortSelect = screen.getByDisplayValue('Recently Used');
    fireEvent.change(sortSelect, { target: { value: 'mostUsed' } });

    // Search for "rock"
    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'rock' } });

    await waitFor(() => {
      const cards = screen.getAllByRole('heading', { level: 3 });
      expect(cards[0]).toHaveTextContent('Rock Mix B'); // Higher use count
      expect(cards[1]).toHaveTextContent('Rock Mix A');
    });
  });

  it('should use updatedAt when lastUsedAt is not available', async () => {
    const templatesWithoutUsage = [
      {
        ...mockTemplates[0],
        lastUsedAt: undefined,
        updatedAt: Date.now() / 1000 - 86400, // 1 day ago
      },
      {
        ...mockTemplates[1],
        lastUsedAt: undefined,
        updatedAt: Date.now() / 1000, // Just now
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ templates: templatesWithoutUsage }),
    });

    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Rock Classics')).toBeInTheDocument();
    });

    const cards = screen.getAllByRole('heading', { level: 3 });
    expect(cards[0]).toHaveTextContent('Rock Classics'); // Most recent updatedAt
    expect(cards[1]).toHaveTextContent('Chill Evening Mix');
  });
});

describe('TemplateList - Delete Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ templates: mockTemplates }),
    });
  });

  it('should open delete dialog when delete button is clicked', async () => {
    const onDelete = jest.fn();
    render(<TemplateList onDelete={onDelete} />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete chill evening mix template/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete Template?')).toBeInTheDocument();
      expect(screen.getAllByText(/Chill Evening Mix/)[0]).toBeInTheDocument();
    });
  });

  it('should close delete dialog when cancel is clicked', async () => {
    const onDelete = jest.fn();
    render(<TemplateList onDelete={onDelete} />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Delete Template?')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Delete Template?')).not.toBeInTheDocument();
    });
  });

  it('should delete template when confirmed', async () => {
    const onDelete = jest.fn();
    
    // Mock successful delete
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: mockTemplates }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Template deleted successfully' }),
      });

    render(<TemplateList onDelete={onDelete} />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    // Click the first delete button (from template card)
    const deleteButton = screen.getByRole('button', { name: /delete chill evening mix template/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete Template?')).toBeInTheDocument();
    });

    // Get the confirm button from the dialog
    const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/mix-templates/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(1);
      expect(screen.queryByText('Chill Evening Mix')).not.toBeInTheDocument();
    });
  });

  it('should show success message after deletion', async () => {
    const onDelete = jest.fn();
    
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: mockTemplates }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Template deleted successfully' }),
      });

    render(<TemplateList onDelete={onDelete} />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete chill evening mix template/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete Template?')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Template "Chill Evening Mix" deleted successfully/)).toBeInTheDocument();
    });
  });

  it('should handle delete error gracefully', async () => {
    const onDelete = jest.fn();
    
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: mockTemplates }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to delete' }),
      });

    render(<TemplateList onDelete={onDelete} />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    // Click the first delete button (from template card)
    const deleteButton = screen.getByRole('button', { name: /delete chill evening mix template/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete Template?')).toBeInTheDocument();
    });

    // Get the confirm button from the dialog
    const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to delete template/i)).toBeInTheDocument();
    });

    // Error should be shown, but templates list should be cleared due to error state
    // This is expected behavior - when there's an error, the component shows error state
  });

  it('should disable buttons during deletion', async () => {
    const onDelete = jest.fn();
    
    let resolveDelete: (value: any) => void;
    const deletePromise = new Promise((resolve) => {
      resolveDelete = resolve;
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: mockTemplates }),
      })
      .mockReturnValueOnce(deletePromise);

    render(<TemplateList onDelete={onDelete} />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete chill evening mix template/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete Template?')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    });

    // Resolve the delete
    resolveDelete!({
      ok: true,
      json: async () => ({ message: 'Template deleted successfully' }),
    });

    await waitFor(() => {
      expect(screen.queryByText('Delete Template?')).not.toBeInTheDocument();
    });
  });

  it('should not show delete button when onDelete prop is not provided', async () => {
    render(<TemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Chill Evening Mix')).toBeInTheDocument();
    });

    const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
    expect(deleteButtons).toHaveLength(0);
  });
});
