import { type FC, useState, useEffect, useMemo, useCallback, memo } from 'react';
import { DeleteTemplateDialog } from './DeleteTemplateDialog';
import { useApp } from '../contexts/AppContext';
import './TemplateList.css';

export interface MixTemplateConfiguration {
  mixType: 'artist' | 'album' | 'genre' | 'mood' | 'decade' | 'custom';
  trackCount: number;
  sortBy?: 'random' | 'rating' | 'playCount' | 'dateAdded';
  artistIds?: string[];
  albumIds?: string[];
  genres?: string[];
  moods?: string[];
  decades?: number[];
  customRules?: {
    includeGenres?: string[];
    excludeGenres?: string[];
    minRating?: number;
    maxRating?: number;
    yearRange?: { min: number; max: number };
    includeUnplayed?: boolean;
  };
  allowDuplicateArtists?: boolean;
  allowDuplicateAlbums?: boolean;
  maxTracksPerArtist?: number;
  maxTracksPerAlbum?: number;
}

export interface MixTemplate {
  id: number;
  name: string;
  description?: string;
  mixType: string;
  configuration: MixTemplateConfiguration;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  useCount: number;
}

interface TemplateListProps {
  onGenerate?: (template: MixTemplate) => void;
  onSchedule?: (template: MixTemplate) => void;
  onEdit?: (template: MixTemplate) => void;
}

// Memoized TemplateCard component to prevent unnecessary re-renders
interface TemplateCardProps {
  template: MixTemplate;
  onGenerate?: (template: MixTemplate) => void;
  onSchedule?: (template: MixTemplate) => void;
  onEdit?: (template: MixTemplate) => void;
  onDelete: (template: MixTemplate) => void;
  actionLoading: { [key: number]: string };
  handleActionWithLoading: (
    templateId: number,
    action: string,
    callback: (template: MixTemplate) => void,
    template: MixTemplate
  ) => Promise<void>;
  getTemplateMetadata: (template: MixTemplate) => string;
  formatDate: (timestamp: number) => string;
}

const TemplateCard: FC<TemplateCardProps> = memo(({
  template,
  onGenerate,
  onSchedule,
  onEdit,
  onDelete,
  actionLoading,
  handleActionWithLoading,
  getTemplateMetadata,
  formatDate
}) => {
  return (
    <div key={template.id} className="template-card" role="listitem">
      <div className="template-card-header">
        <div className="template-card-title">
          <h3>{template.name}</h3>
        </div>
      </div>

      {template.description && (
        <p className="template-description">{template.description}</p>
      )}

      <div className="template-metadata" aria-label="Template details">
        <span>{getTemplateMetadata(template)}</span>
      </div>

      <div className="template-stats" aria-label="Template statistics">
        <span className="template-stat">
          Used {template.useCount} {template.useCount === 1 ? 'time' : 'times'}
        </span>
        <span className="template-stat">
          {template.lastUsedAt
            ? `Last used ${formatDate(template.lastUsedAt)}`
            : `Created ${formatDate(template.createdAt)}`}
        </span>
      </div>

      <div className="template-actions" role="group" aria-label="Template actions">
        {onGenerate && (
          <button
            className={`btn btn-primary btn-small ${actionLoading[template.id] === 'generate' ? 'btn-loading' : ''}`}
            onClick={() => handleActionWithLoading(template.id, 'generate', onGenerate, template)}
            disabled={!!actionLoading[template.id]}
            title="Generate mix from template"
            aria-label={`Generate mix from ${template.name} template`}
          >
            Generate
          </button>
        )}
        {onSchedule && (
          <button
            className={`btn btn-secondary btn-small ${actionLoading[template.id] === 'schedule' ? 'btn-loading' : ''}`}
            onClick={() => handleActionWithLoading(template.id, 'schedule', onSchedule, template)}
            disabled={!!actionLoading[template.id]}
            title="Schedule this mix"
            aria-label={`Schedule ${template.name} mix`}
          >
            Schedule
          </button>
        )}
        {onEdit && (
          <button
            className={`btn btn-secondary btn-small ${actionLoading[template.id] === 'edit' ? 'btn-loading' : ''}`}
            onClick={() => handleActionWithLoading(template.id, 'edit', onEdit, template)}
            disabled={!!actionLoading[template.id]}
            title="Edit template"
            aria-label={`Edit ${template.name} template`}
          >
            Edit
          </button>
        )}
        <button
          className="btn btn-danger btn-small"
          onClick={() => onDelete(template)}
          disabled={!!actionLoading[template.id]}
          title="Delete template"
          aria-label={`Delete ${template.name} template`}
        >
          Delete
        </button>
      </div>
    </div>
  );
});

export const TemplateList: FC<TemplateListProps> = ({
  onGenerate,
  onSchedule,
  onEdit,
}) => {
  const { apiClient } = useApp();
  const [templates, setTemplates] = useState<MixTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<MixTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getMixTemplates();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, [apiClient]);

  const handleDelete = useCallback(async (templateId: number) => {
    setIsDeleting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await apiClient.deleteMixTemplate(templateId);

      // Remove from list using functional update to avoid stale closure
      setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== templateId));
      
      // Show success message
      setSuccessMessage(`Saved mix "${templateToDelete?.name}" deleted successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Close dialog
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      
      // Don't call parent callback - we're managing state internally
      // onDelete?.(templateId);
    } catch (err) {
      // If template not found, it's already deleted - just remove from UI and show success
      const isNotFound = 
        (err instanceof Error && (err.message.includes('not found') || err.message.includes('NOT_FOUND'))) ||
        (err && typeof err === 'object' && 'code' in err && err.code === 'NOT_FOUND');
      
      if (isNotFound) {
        setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== templateId));
        setSuccessMessage(`Saved mix "${templateToDelete?.name}" deleted successfully`);
        setTimeout(() => setSuccessMessage(null), 3000);
        setDeleteDialogOpen(false);
        setTemplateToDelete(null);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to delete template. Please try again.');
        setDeleteDialogOpen(false);
        setTemplateToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  }, [apiClient, templateToDelete]);

  const openDeleteDialog = useCallback((template: MixTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (!isDeleting) {
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  }, [isDeleting]);

  const handleActionWithLoading = useCallback(async (
    templateId: number,
    action: string,
    callback: (template: MixTemplate) => void,
    template: MixTemplate
  ) => {
    setActionLoading(prev => ({ ...prev, [templateId]: action }));
    try {
      await callback(template);
    } finally {
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState[templateId];
        return newState;
      });
    }
  }, []);

  const formatDate = useCallback((timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }, []);

  const getTemplateMetadata = useCallback((template: MixTemplate): string => {
    const parts: string[] = [];
    
    parts.push(`${template.configuration.trackCount} tracks`);
    
    if (template.configuration.artistIds?.length) {
      parts.push(`${template.configuration.artistIds.length} artists`);
    }
    if (template.configuration.albumIds?.length) {
      parts.push(`${template.configuration.albumIds.length} albums`);
    }
    if (template.configuration.genres?.length) {
      parts.push(`${template.configuration.genres.length} genres`);
    }
    
    return parts.join(' • ');
  }, []);

  // Memoize filtered and sorted templates for performance
  const filteredTemplates = useMemo(() => {
    return templates.sort((a, b) => {
      // Sort by most recently used/updated
      return (b.lastUsedAt || b.updatedAt) - (a.lastUsedAt || a.updatedAt);
    });
  }, [templates]);

  if (isLoading) {
    return (
      <div className="template-list" role="region" aria-label="Saved Mixes">
        <div className="template-list-header">
          <h2>Saved Mixes</h2>
        </div>
        <div className="template-list-loading" role="status" aria-live="polite">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>Loading templates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="template-list" role="region" aria-label="Saved Mixes">
        <div className="template-list-header">
          <h2>Saved Mixes</h2>
        </div>
        <div className="template-list-error" role="alert" aria-live="assertive">
          <p>{error}</p>
          <button 
            className="btn btn-secondary btn-small" 
            onClick={loadTemplates}
            aria-label="Retry loading templates"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="template-list" role="region" aria-label="Saved Mixes">
      <div className="template-list-header">
        <h2>Saved Mixes</h2>
        <span className="template-count" aria-label={`${templates.length} mixes`}>
          {templates.length}
        </span>
      </div>

      {successMessage && (
        <div className="template-list-success" role="status" aria-live="polite">
          {successMessage}
        </div>
      )}

      {filteredTemplates.length === 0 ? (
        <div className="template-list-empty" role="status">
          <p>No saved mixes yet</p>
          <p className="template-list-empty-hint">
            Create a custom mix and save it to get started
          </p>
        </div>
      ) : (
        <div className="template-list-grid" role="list">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onGenerate={onGenerate}
              onSchedule={onSchedule}
              onEdit={onEdit}
              onDelete={openDeleteDialog}
              actionLoading={actionLoading}
              handleActionWithLoading={handleActionWithLoading}
              getTemplateMetadata={getTemplateMetadata}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && templateToDelete && (
        <DeleteTemplateDialog
          templateName={templateToDelete.name}
          onConfirm={() => handleDelete(templateToDelete.id)}
          onCancel={closeDeleteDialog}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};
