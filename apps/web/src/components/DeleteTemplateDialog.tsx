import { type FC, useEffect } from 'react';
import './DeleteTemplateDialog.css';

interface DeleteTemplateDialogProps {
  templateName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export const DeleteTemplateDialog: FC<DeleteTemplateDialogProps> = ({
  templateName,
  onConfirm,
  onCancel,
  isDeleting,
}) => {
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter to confirm
      if (e.key === 'Enter' && !isDeleting) {
        e.preventDefault();
        onConfirm();
      }
      // Escape to cancel
      if (e.key === 'Escape' && !isDeleting) {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDeleting, onConfirm, onCancel]);

  // Focus trap
  useEffect(() => {
    const modal = document.querySelector('.delete-dialog-modal');
    const focusableElements = modal?.querySelectorAll(
      'button, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements?.[0] as HTMLElement;
    const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement;

    // Focus first button on mount
    firstElement?.focus();

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

  return (
    <div 
      className="delete-dialog-overlay" 
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-message"
    >
      <div className="delete-dialog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="delete-dialog-header">
          <div className="delete-dialog-icon" aria-hidden="true">⚠️</div>
          <h2 id="delete-dialog-title" className="delete-dialog-title">
            Delete Template?
          </h2>
        </div>

        <div className="delete-dialog-content">
          <p id="delete-dialog-message" className="delete-dialog-message">
            Are you sure you want to delete <strong>"{templateName}"</strong>?
          </p>
          <p className="delete-dialog-warning" role="alert">
            This action cannot be undone.
          </p>
        </div>

        <div className="delete-dialog-actions">
          <button
            onClick={onConfirm}
            className={`btn-delete ${isDeleting ? 'btn-loading' : ''}`}
            disabled={isDeleting}
            aria-label={isDeleting ? 'Deleting template...' : 'Confirm delete'}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            onClick={onCancel}
            className="btn-cancel"
            disabled={isDeleting}
            aria-label="Cancel deletion"
          >
            Cancel
          </button>
        </div>

        <div className="delete-dialog-hint" role="note">
          Press <kbd>Enter</kbd> to confirm • <kbd>Esc</kbd> to cancel
        </div>
      </div>
    </div>
  );
};
