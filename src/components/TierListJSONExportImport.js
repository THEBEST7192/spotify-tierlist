import React, { useRef } from 'react';

const TierListJSONExportImport = ({ tiers, tierOrder, state, onImport }) => {
  const fileInputRef = useRef(null);

  const handleExport = () => {
    const data = { tiers, tierOrder, state };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tierlist.json';
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
