import { type FC, useState, useEffect } from 'react';
import './SaveTemplateModal.css';

interface SaveTemplateModalProps {
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
  isSaving: boolean;
  initialName?: string;
  initialDescription?: string;
}

export const SaveTemplateModal: FC<SaveTemplateModalProps> = ({ onClose, onSave, isSaving, initialName = '', initialDescription = '' }) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
  }>({});

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (name.trim() && !isSaving) {
          handleSave();
        }
      }
      // Escape to close
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
      // Enter to save (when not in textarea)
      if (e.key === 'Enter' && !isSaving && e.target instanceof HTMLInputElement) {
        e.preventDefault();
        if (name.trim()) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [name, isSaving, onClose]);

  // Focus trap
  useEffect(() => {
    const modal = document.querySelector('.save-template-modal');
    const focusableElements = modal?.querySelectorAll(
      'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements?.[0] as HTMLElement;
    const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleTabKey);
    return () => window.removeEventListener('keydown', handleTabKey);
  }, []);

  const validateName = (value: string): string | undefined => {
    if (!value.trim()) {
      return 'Template name is required';
    }
    if (value.length > 100) {
      return 'Template name must be 100 characters or less';
    }
    return undefined;
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (validationErrors.name) {
      setValidationErrors({});
    }
    setError(null);
  };

  const handleNameBlur = () => {
    const error = validateName(name);
    if (error) {
      setValidationErrors({ name: error });
    }
  };

  const handleSave = async () => {
    setError(null);

    // Validate name
    const nameError = validateName(name);
    if (nameError) {
      setValidationErrors({ name: nameError });
      setError(nameError);
      return;
    }

    try {
      await onSave(name.trim(), description.trim());
      // Modal will be closed by parent component on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template. Please try again.');
    }
  };

  return (
    <div 
      className="save-template-overlay" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-template-title"
    >
      <div className="save-template-modal" onClick={(e) => e.stopPropagation()}>
        <div className="save-template-header">
          <h2 id="save-template-title" className="save-template-title">Save Mix</h2>
          <button 
            className="save-template-close" 
            onClick={onClose} 
            disabled={isSaving}
            aria-label="Close dialog"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        <div className="save-template-content">
          {error && (
            <div className="save-template-error" role="alert" aria-live="assertive">
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="template-name">
              Mix Name <span className="required" aria-label="required">*</span>
            </label>
            <input
              id="template-name"
              type="text"
              className={`form-input ${validationErrors.name ? 'error' : ''}`}
              placeholder="e.g., Chill Evening Mix"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleNameBlur}
              disabled={isSaving}
              autoFocus
              maxLength={100}
              aria-required="true"
              aria-invalid={!!validationErrors.name}
              aria-describedby={validationErrors.name ? 'name-error' : 'name-hint'}
            />
            {validationErrors.name && (
              <div id="name-error" className="field-error" role="alert">
                {validationErrors.name}
              </div>
            )}
            <div id="name-hint" className="field-hint" aria-live="polite">
              {name.length}/100 characters
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="template-description">
              Description (optional)
            </label>
            <textarea
              id="template-description"
              className="form-textarea"
              placeholder="Add a description for this saved mix..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              rows={3}
              maxLength={500}
              aria-describedby="description-hint"
            />
            <div id="description-hint" className="field-hint" aria-live="polite">
              {description.length}/500 characters
            </div>
          </div>

          <div className="save-template-hint" role="note">
            Press <kbd>Ctrl+S</kbd> or <kbd>Enter</kbd> to save quickly • <kbd>Esc</kbd> to cancel
          </div>
        </div>

        <div className="save-template-actions">
          <button
            onClick={handleSave}
            className={`btn-save ${isSaving ? 'btn-loading' : ''}`}
            disabled={isSaving || !name.trim()}
            aria-label={isSaving ? 'Saving mix...' : 'Save mix'}
          >
            {isSaving ? 'Saving...' : 'Save Mix'}
          </button>
          <button
            onClick={onClose}
            className="btn-cancel"
            disabled={isSaving}
            aria-label="Cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
