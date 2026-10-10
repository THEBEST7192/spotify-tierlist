import React from "react";
import RecommendationGenerator from '../RecommendationGenerator';
import TierListJSONExportImport from '../TierListJSONExportImport';
import { exportTierListImage } from './tierListUtils';

const TierListActions = ({
  tiers,
  tierOrder,
  state,
  playlistName,
  handleImport,
  handleUploadTierlist,
  uploadingTierlist,
  uploadedTierlist,
  resolvedCoverImage,
  resetSongs,
  tuneTierUser,
  uploadMessage,
  uploadError,
  uploadShareUrl,
  playTrack,
  addSongToTierlist,
  currentTrack,
  isPlayerPlaying
}) => {
  const tierlistOwnerUsername = uploadedTierlist?.onlineUsername || uploadedTierlist?.username;
  const tierlistOwnerUserId = uploadedTierlist?.onlineOwnerUserId || uploadedTierlist?.ownerUserId;
  const hasOnlineTierlistId = uploadedTierlist?.shortId || uploadedTierlist?.onlineShortId;
  const isOwnedById = tierlistOwnerUserId && tuneTierUser?._id && String(tierlistOwnerUserId) === String(tuneTierUser._id);
  const isOwnedByUsername = tierlistOwnerUsername && tuneTierUser?.username && tierlistOwnerUsername === tuneTierUser.username;
  const isRemix = Boolean(hasOnlineTierlistId && !(isOwnedById || isOwnedByUsername));

  return (
    <div className="tier-list-actions">
      <div className="tier-list-primary-actions">
        <div className="export-group">
          <button className="export-button export-image-button" onClick={() => exportTierListImage(playlistName)}>
            Export as Image
          </button>
          <TierListJSONExportImport
            tiers={tiers}
            tierOrder={tierOrder}
            state={state}
            onImport={handleImport}
            tierListName={playlistName}
            onUpload={handleUploadTierlist}
            uploading={uploadingTierlist}
            uploadedTierlist={uploadedTierlist}
            uploadMessage=""
            uploadError=""
            uploadShareUrl=""
            coverImage={resolvedCoverImage}
            resetButton={true}
            onReset={resetSongs}
            isRemix={isRemix}
          />
        </div>

        {(uploadMessage || uploadError) && (
          <div className="upload-status-container">
            {uploadMessage && (
              <div className="success-message upload-status">
                {uploadMessage}
                {uploadShareUrl && (
                  <>
                    {' '}
                    <a href={uploadShareUrl} target="_blank" rel="noopener noreferrer">
                      {uploadShareUrl}
                    </a>
                  </>
                )}
              </div>
            )}
            {uploadError && <div className="error-message upload-status">{uploadError}</div>}
          </div>
        )}
      </div>

      <div className="tier-secondary-actions">
        <RecommendationGenerator
          tierState={state}
          tierOrder={tierOrder}
          tiers={tiers}
          tuneTierUser={tuneTierUser}
          onPlayTrack={playTrack}
          onAddToTierlist={addSongToTierlist}
          currentTrackId={currentTrack}
          isPlayerPlaying={isPlayerPlaying}
        />
      </div>
    </div>
  );
};

export default TierListActions;
