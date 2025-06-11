import React, { useRef } from 'react';

const TierListJSONExportImport = ({ tiers, tierOrder, state, onImport, tierListName = '' }) => {
  const fileInputRef = useRef(null);

  const handleExport = () => {
    const data = { 
      tiers, 
      tierOrder, 
      state: {
        ...state,
        tierListName: tierListName // Ensure tierListName is included in the state
      } 
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Use the tier list name in the filename, with fallback to 'tierlist' if not available
    // Keep hyphens in the filename as they are valid in filenames
    const filename = tierListName ? 
      `${tierListName.replace(/[^a-z0-9-]/gi, '_').toLowerCase()}.json` : 
      'tierlist.json';
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        onImport(imported);
      } catch (err) {
        console.error('Failed to import JSON:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  return (
    <>
      <div className="export-group">
        <button className="export-button export-json-button" onClick={handleExport}>Export JSON</button>
        <button className="export-button import-json-button" onClick={handleImportClick}>Import JSON</button>
      </div>
      <input
        type="file"
        accept="application/json"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </>
  );
};

export default TierListJSONExportImport;
