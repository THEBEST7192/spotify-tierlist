import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import spotifyIconOfficial from '../../assets/spotify/spotify-icon-official.png';
import { getItemStyle } from './tierListUtils';
import { makeVinylFallback } from '../../utils/imageFallback';
import { VinylSvg } from '../../utils/vinylGenerator';

const SongCard = ({ item, index, isPlaying, isFocused, isPickedUp, onPlayTrack }) => {
  if (!item || !item.content) return null;
  const song = item.content;

  return (
    <Draggable
      key={item.id}
      draggableId={item.id}
      index={index}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={getItemStyle(
            snapshot.isDragging,
            provided.draggableProps.style
          )}
          data-song-id={item.id}
          className={`song-card ${isPlaying ? 'playing' : ''} ${isFocused ? 'focused' : ''} ${isPickedUp ? 'picked-up' : ''}`}
        >
          {song.album && song.album.images && song.album.images.length > 0 ? (
            <a
              href={song.id ? `https://open.spotify.com/track/${song.id}` : "#"}
              target={song.id ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="album-cover-link"
              onClick={(e) => {
                if (!song.id) e.preventDefault();
                e.stopPropagation();
              }}
            >
              <img
                src={song.album.images[song.album.images.length > 2 ? 2 : 0].url}
                alt={song.album.name || "Album Cover"}
                className="album-cover"
                onError={makeVinylFallback(song.placeholderColor)}
              />
            </a>
          ) : (
            <div className="album-cover-placeholder-wrapper">
              <div
                className="tierlist-song-placeholder"
                style={{ backgroundColor: '#121212' }}
              >
                <VinylSvg color={song.placeholderColor || '#1DB954'} className="placeholder-svg-small" />
              </div>
            </div>
          )}
          <div className="song-info">
            <div className="song-name">{song.name}</div>
            <div className="song-artist">
              {song.artists && song.artists.map(artist => artist.name).join(", ")}
            </div>
          </div>
          <div className="song-actions">
            <button
              className={`play-preview-button ${isPlaying ? 'playing' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onPlayTrack(song.id);
              }}
              aria-label={isPlaying ? "Pause preview" : "Play preview"}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <a
              href={`https://open.spotify.com/track/${song.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="spotify-icon-link"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={spotifyIconOfficial}
                alt="Spotify"
                className="spotify-icon-small"
              />
            </a>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default SongCard;
