import React from "react";
import ConfirmationDialog from "../ConfirmationDialog";

const TierListDialogs = ({
  showUnavailableDialog,
  unavailableSongs,
  onUnavailableSongsChoice,
  showRemixDialog,
  onCloseRemix,
  onConfirmRemix
}) => (
  <>
    <ConfirmationDialog
      isOpen={showUnavailableDialog}
      onClose={() => onUnavailableSongsChoice(false)}
      onConfirm={() => onUnavailableSongsChoice(true)}
      title="Unavailable Songs Detected"
      confirmText="Remove Unavailable Songs"
      cancelText="Keep Songs"
      message={
        <>
          <p>We found {unavailableSongs.length} song{unavailableSongs.length > 1 ? 's' : ''} that may not be playable:</p>
          <ul className="unavailable-songs-list">
            {unavailableSongs.slice(0, 5).map((song, index) => (
              <li key={index}>
                {song.name} by {song.artist}
                {song.tier !== 'Unranked' ? ` (in ${song.tier} tier)` : ''}
              </li>
            ))}
            {unavailableSongs.length > 5 && <li>...and {unavailableSongs.length - 5} more</li>}
          </ul>
          <p>These songs may have been removed from Spotify or may not be available in your region.</p>
          <p>Would you like to remove them from your tier list?</p>
        </>
      }
    />
    <ConfirmationDialog
      isOpen={showRemixDialog}
      onClose={onCloseRemix}
      onConfirm={onConfirmRemix}
      title="Remix Online Tierlist"
      message="This tierlist was created by another user. Do you want to remix it as your own tierlist?"
      confirmText="Remix"
    />
  </>
);

export default TierListDialogs;
