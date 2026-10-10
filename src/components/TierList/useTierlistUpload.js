import { useState } from "react";
import { createTierlist, updateTierlist } from '../../utils/backendApi';

export const useTierlistUpload = ({
  tuneTierUser,
  state,
  setState,
  tiers,
  tierOrder,
  playlistName,
  storageKey,
  getFirstAvailableCoverImage,
  navigate
}) => {
  const [uploadedTierlist, setUploadedTierlist] = useState(null);
  const [uploadingTierlist, setUploadingTierlist] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadShareUrl, setUploadShareUrl] = useState('');
  const [showRemixDialog, setShowRemixDialog] = useState(false);

  const performUploadTierlist = async ({ remix = false } = {}) => {
    setUploadError('');
    setUploadMessage('');
    setUploadShareUrl('');
    setUploadingTierlist(true);

    try {
      if (!tuneTierUser) {
        throw new Error(remix
          ? 'Remix: Please log in to your account before uploading tierlists.'
          : 'Please log in to your account before uploading tierlists.');
      }

      const isUpdate = !remix && Boolean(uploadedTierlist?.shortId || uploadedTierlist?.onlineShortId);
      const resolvedTierListName = state.tierListName || playlistName || 'My Spotify Tierlist';
      const existingCoverImage = typeof state?.coverImage === 'string' && state.coverImage.trim()
        ? state.coverImage.trim()
        : '';
      const coverImage = existingCoverImage || getFirstAvailableCoverImage();
      const description = uploadedTierlist?.description || uploadedTierlist?.state?.description || state?.description || '';
      const tierlistState = {
        ...state,
        tierListName: resolvedTierListName,
        description,
        ...(coverImage ? { coverImage } : {})
      };
      const payload = {
        username: tuneTierUser.username,
        tierListName: resolvedTierListName,
        description,
        coverImage,
        tiers,
        tierOrder,
        state: tierlistState,
        isPublic: true
      };
      const response = isUpdate
        ? await updateTierlist(uploadedTierlist.shortId || uploadedTierlist.onlineShortId, payload)
        : await createTierlist(payload);
      const resolvedResponse = response || uploadedTierlist;

      if (!resolvedResponse) {
        throw new Error('No response received from tierlist service');
      }

      setUploadedTierlist(resolvedResponse);
      setState(prev => ({
        ...prev,
        tierListName: resolvedTierListName,
        ...(coverImage ? { coverImage } : {})
      }));

      if (storageKey && typeof window !== 'undefined') {
        try {
          const isOnlineTierlist = window.location.pathname.includes('/tierlists/');
          if (isOnlineTierlist && resolvedResponse.shortId) {
            const updatedLocalCopy = {
              ...resolvedResponse,
              onlineShortId: resolvedResponse.shortId,
              onlineUsername: uploadedTierlist?.onlineUsername || uploadedTierlist?.username || resolvedResponse.username,
              onlineOwnerUserId: uploadedTierlist?.onlineOwnerUserId || uploadedTierlist?.ownerUserId || resolvedResponse.ownerUserId,
              isOnlineTierlist: true,
              isPublic: resolvedResponse.isPublic !== false
            };
            localStorage.setItem(`tierlist:${resolvedResponse.shortId}`, JSON.stringify(updatedLocalCopy));
          }
        } catch (err) {
          console.warn('Failed to update local copy of online tierlist:', err);
        }
      }

      const shareUrl = resolvedResponse?.shortId && typeof window !== 'undefined'
        ? `${window.location.origin}/tierlists/${resolvedResponse.shortId}`
        : '';
      setUploadShareUrl(shareUrl);
      setUploadMessage(
        `Tierlist ${remix ? 'remixed' : (isUpdate ? 'updated' : 'uploaded')} successfully!${shareUrl ? '' : ` ID: ${resolvedResponse?.shortId || ''}`}`
      );

      if (remix && resolvedResponse?.shortId && typeof window !== 'undefined') {
        const originalShortId = uploadedTierlist.shortId || uploadedTierlist.onlineShortId;
        try {
          localStorage.setItem('pendingTierlistDeletion', JSON.stringify({ shortId: originalShortId }));
        } catch (err) {
          console.warn('Failed to store pending deletion:', err);
        }
        navigate(`/tierlists/${resolvedResponse.shortId}`);
      }
    } catch (error) {
      console.error('Failed to upload tierlist:', error);
      const backendMessage = error.response?.data?.error;
      setUploadError(backendMessage || error.message || 'Failed to upload tierlist');
    } finally {
      setUploadingTierlist(false);
    }
  };

  const handleUploadTierlist = async () => {
    const tierlistOwnerUsername = uploadedTierlist?.onlineUsername || uploadedTierlist?.username;
    const tierlistOwnerUserId = uploadedTierlist?.onlineOwnerUserId || uploadedTierlist?.ownerUserId;
    const hasOnlineTierlistId = uploadedTierlist?.shortId || uploadedTierlist?.onlineShortId;
    const isOwnedById = tierlistOwnerUserId && tuneTierUser?._id && String(tierlistOwnerUserId) === String(tuneTierUser._id);
    const isOwnedByUsername = tierlistOwnerUsername && tuneTierUser?.username && tierlistOwnerUsername === tuneTierUser.username;

    if (hasOnlineTierlistId && !tuneTierUser?.username) {
      setUploadMessage('');
      setUploadShareUrl('');
      setUploadError('Remix: Please log in to your account before uploading tierlists.');
      return;
    }

    if (hasOnlineTierlistId && !isOwnedById && !isOwnedByUsername) {
      setShowRemixDialog(true);
      return;
    }

    await performUploadTierlist();
  };

  return {
    uploadedTierlist,
    setUploadedTierlist,
    uploadingTierlist,
    uploadMessage,
    uploadError,
    uploadShareUrl,
    setUploadShareUrl,
    showRemixDialog,
    setShowRemixDialog,
    handleUploadTierlist,
    performUploadTierlist
  };
};
