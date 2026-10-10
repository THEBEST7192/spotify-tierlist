import { useCallback, useState } from "react";

export const useTierlistPlayer = () => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const [isPlayerVisible, setIsPlayerVisible] = useState(true);

  const playTrack = useCallback((trackId) => {
    console.log('[TierList] playTrack called with', trackId, 'isPlayerVisible:', isPlayerVisible, 'currentTrack:', currentTrack, 'isPlayerPlaying:', isPlayerPlaying, 'at', Date.now());
    if (!isPlayerVisible) {
      setIsPlayerVisible(true);
      setCurrentTrack(trackId);
      setIsPlayerPlaying(true);
    } else if (trackId === currentTrack) {
      setIsPlayerPlaying(!isPlayerPlaying);
    } else {
      setCurrentTrack(trackId);
      setIsPlayerPlaying(true);
    }
    try {
      const event = new CustomEvent('spotifyPlayerRequestPlay', { detail: { trackId } });
      document.dispatchEvent(event);
    } catch { /* ignore */ }
  }, [isPlayerVisible, currentTrack, isPlayerPlaying]);

  const handleTrackEnd = () => {
    console.log('[TierList] handleTrackEnd called, clearing currentTrack at', Date.now(), 'currentTrack:', currentTrack, 'isPlayerPlaying:', isPlayerPlaying);
    setCurrentTrack(null);
    setIsPlayerPlaying(false);
  };

  const handlePlayerStateChange = (isPlaying) => {
    setIsPlayerPlaying(isPlaying);
  };

  const handlePlayerClose = () => {
    console.log('[TierList] handlePlayerClose called, hiding player');
    setIsPlayerVisible(false);
    setIsPlayerPlaying(false);
    setCurrentTrack(null);
  };

  return {
    currentTrack,
    isPlayerPlaying,
    isPlayerVisible,
    playTrack,
    handleTrackEnd,
    handlePlayerStateChange,
    handlePlayerClose
  };
};
