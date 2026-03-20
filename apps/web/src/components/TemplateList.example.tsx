/**
 * Example integration of TemplateList component into GenerateMixesPage
 * 
 * This file shows how to integrate the TemplateList component.
 * The actual integration will be done in a separate task.
 */

import { TemplateList, type MixTemplate } from './TemplateList';

// Example usage in GenerateMixesPage:

/*
export const GenerateMixesPage: FC = () => {
  // ... existing state ...

  // Add handlers for template actions
  const handleLoadTemplate = (template: MixTemplate) => {
    console.log('Loading template:', template);
    // TODO: Populate mix builder with template configuration
    // This will be implemented in Task 2.5
  };

  const handleGenerateFromTemplate = async (template: MixTemplate) => {
    console.log('Generating from template:', template);
    // TODO: Call API to generate mix from template
    // This will be implemented in Task 3.2
  };

  const handleEditTemplate = (template: MixTemplate) => {
    console.log('Editing template:', template);
    // TODO: Open edit modal with template data
    // This will be implemented in Task 2.3
  };

  const handleDeleteTemplate = (templateId: number) => {
    console.log('Template deleted:', templateId);
    // Optional: Show success message or refresh data
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Generate Mixes</h1>
        <p className="page-description">Generate personalized playlists based on your listening history</p>
      </div>

      {/* Add TemplateList component before or after the mix cards *\/}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <TemplateList
          onLoad={handleLoadTemplate}
          onGenerate={handleGenerateFromTemplate}
          onEdit={handleEditTemplate}
          onDelete={handleDeleteTemplate}
        />
      </div>

      {/* ... rest of the existing page content ... *\/}
    </div>
  );
};
*/

// Alternative layout: Side-by-side with mix cards
/*
<div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', marginBottom: '2rem' }}>
  {/* Left column: Templates *\/}
  <div className="card">
    <TemplateList
      onLoad={handleLoadTemplate}
      onGenerate={handleGenerateFromTemplate}
      onEdit={handleEditTemplate}
      onDelete={handleDeleteTemplate}
    />
  </div>

  {/* Right column: Mix builder *\/}
  <div className="card">
    {/* ... existing mix cards ... *\/}
  </div>
</div>
*/
