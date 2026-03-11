import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { getUserPlaylists, getCurrentUser } from "../utils/spotifyApi";
import { getPublicTierlists, getUserTierlists, updateTierlist, getTierlist, toggleTierlistPrivacy, deleteTierlist, transferTierlistOwnership } from "../utils/backendApi";
import AuthButton from "./AuthButton";
import CSVImportSelector from "./CSVImportSelector";
import "./PlaylistSelector.css";

const MAX_UPLOAD_BYTES = 100 * 1024; // 100KB
const MAX_RESIZE_ATTEMPTS = 10;
const SCALE_STEP = 0.85;
const QUALITY_STEP = 0.9;

const pickBestSongImageUrl = (images = []) => {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const exact300 = images.find((img) => Number(img?.width) === 300 || Number(img?.height) === 300);
  if (exact300?.url) {
    return exact300.url;
  }

  const mediumImage = images.length > 1 ? images[1] : null;
  if (mediumImage?.url) {
    return mediumImage.url;
  }

  return images[0]?.url || null;
};

const extractFirstSongImageFromTierlist = (tierlistData) => {
  if (!tierlistData || typeof tierlistData !== 'object') {
    return null;
  }

  const tierState = tierlistData.state;
  if (!tierState || typeof tierState !== 'object') {
    return null;
  }

  const tierOrderFromData = Array.isArray(tierlistData.tierOrder)
    ? tierlistData.tierOrder
    : Array.isArray(tierState.tierOrder)
    ? tierState.tierOrder
    : Object.keys(tierState).filter((key) => Array.isArray(tierState[key]));

  for (const tierName of tierOrderFromData) {
    const entries = tierState?.[tierName];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const song = entry?.content || entry;
      const albumImages = song?.album?.images;
      const candidate = pickBestSongImageUrl(albumImages);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
};

const estimateBase64Bytes = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const commaIndex = dataUrl.indexOf(',');
  const base64Length = commaIndex >= 0 ? dataUrl.length - (commaIndex + 1) : dataUrl.length;
  return Math.ceil(base64Length * 3 / 4);
};

const downscaleImageToLimit = (file, limitBytes = MAX_UPLOAD_BYTES) => new Promise((resolve, reject) => {
  if (typeof window === 'undefined') {
    reject(new Error('Image uploads are not supported in this environment.'));
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Failed to read the selected file.'));
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let width = img.width;
        let height = img.height;
        let quality = 0.92;
        let dataUrl = reader.result;
        for (let attempt = 0; attempt < MAX_RESIZE_ATTEMPTS; attempt++) {
          canvas.width = Math.max(1, Math.round(width));
          canvas.height = Math.max(1, Math.round(height));
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL('image/jpeg', Math.min(0.95, quality));
          if (estimateBase64Bytes(dataUrl) <= limitBytes) {
            resolve(dataUrl);
            return;
          }
          width *= SCALE_STEP;
          height *= SCALE_STEP;
          quality *= QUALITY_STEP;
        }
        if (estimateBase64Bytes(dataUrl) <= limitBytes) {
          resolve(dataUrl);
        } else {
          reject(new Error('Could not shrink image under 100KB. Try a smaller image.'));
        }
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Unsupported image file.'));
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

// Helper function to decode HTML entities in text
const decodeHtmlEntities = (text) => {
  if (!text) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

const konamiCode = ['w', 'w', 's', 's', 'a', 'd', 'a', 'd', 'b', 'a'];
const debugModeCode = ['d', 'e', 'b', 'u', 'g', 'm', 'o', 'd', 'e'];

const PlaylistSelector = ({
  accessToken,
  onSelect,
  searchQuery,
  setSearchQuery,
  searchMode,
  setSearchMode,
  onSelectLocalTierlist,
  onSelectOnlineTierlist,
  onSelectImported,
  tuneTierUser
}) => {
  const OWNER_FILTER_STORAGE_KEY = "playlistSelector.onlineOwnerFilter";
  const ONLINE_SORT_STORAGE_KEY = "playlistSelector.onlineSortOption";
  const LOCAL_SORT_STORAGE_KEY = "playlistSelector.localSortOption";

  const [playlists, setPlaylists] = useState([]);
  const [filteredPlaylists, setFilteredPlaylists] = useState([]);
  const [localTierlists, setLocalTierlists] = useState([]);
  const [onlineTierlists, setOnlineTierlists] = useState([]);
  const [refreshTrigger] = useState(0);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [onlineSearchQuery, setOnlineSearchQuery] = useState("");
  const [localSortOption, setLocalSortOption] = useState("name-asc");
  const [onlineSortOption, setOnlineSortOption] = useState("name-asc");
  const [onlineOwnerFilter, setOnlineOwnerFilter] = useState("all");
  const [, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [spotifyUserId, _setSpotifyUserId] = useState(null);
  const [coverUpdatingId, setCoverUpdatingId] = useState(null);
  const [privacyUpdatingId, setPrivacyUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModalPlaylist, setEditModalPlaylist] = useState(null);
  const [editModalContext, setEditModalContext] = useState(null);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editModalSubmitting, setEditModalSubmitting] = useState(false);
  const [editModalError, setEditModalError] = useState(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadDisplayLabel, setUploadDisplayLabel] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editTierlistName, setEditTierlistName] = useState("");
  const [editTierlistDescription, setEditTierlistDescription] = useState("");
  const konamiIndex = useRef(0);
  const debugModeIndex = useRef(0);
  const searchInputRef = useRef(null);
  
  const fileUploadInputRef = useRef(null);
  const [ownedOffset, setOwnedOffset] = useState(0);
  const [hasMoreOwned, setHasMoreOwned] = useState(false);
  const [loadingMoreOwned, setLoadingMoreOwned] = useState(false);

  const checkKonamiCode = useCallback((key) => {
    // Check for Konami code
    if (key === konamiCode[konamiIndex.current]) {
      konamiIndex.current++;
      if (konamiIndex.current === konamiCode.length) {
        // Dispatch a custom event that the Home component can listen for
        window.dispatchEvent(new CustomEvent('konamiCodeActivated'));
        konamiIndex.current = 0;
      }
    } else {
      konamiIndex.current = 0;
    }
    
    // Check for debug mode code
    if (key === debugModeCode[debugModeIndex.current]) {
      debugModeIndex.current++;
      if (debugModeIndex.current === debugModeCode.length) {
        // Dispatch a custom event for debug mode
        window.dispatchEvent(new CustomEvent('debugModeActivated'));
        debugModeIndex.current = 0;
      }
    } else {
      debugModeIndex.current = 0;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedOwnerFilter = window.localStorage.getItem(OWNER_FILTER_STORAGE_KEY);
    if (savedOwnerFilter && ["mine", "others", "all"].includes(savedOwnerFilter)) {
      setOnlineOwnerFilter(savedOwnerFilter);
    }

    const savedOnlineSortOption = window.localStorage.getItem(ONLINE_SORT_STORAGE_KEY);
    if (savedOnlineSortOption && ["name-asc", "name-desc", "newest", "oldest"].includes(savedOnlineSortOption)) {
      setOnlineSortOption(savedOnlineSortOption);
    }

    const savedLocalSortOption = window.localStorage.getItem(LOCAL_SORT_STORAGE_KEY);
    if (savedLocalSortOption && ["name-asc", "name-desc", "newest", "oldest"].includes(savedLocalSortOption)) {
      setLocalSortOption(savedLocalSortOption);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(OWNER_FILTER_STORAGE_KEY, onlineOwnerFilter);
  }, [onlineOwnerFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ONLINE_SORT_STORAGE_KEY, onlineSortOption);
  }, [onlineSortOption]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCAL_SORT_STORAGE_KEY, localSortOption);
  }, [localSortOption]);

  useEffect(() => {
    const fetchFirstPage = async () => {
      console.log("fetchFirstPage - Auth state:", { 
        hasTuneTierUser: !!tuneTierUser, 
        hasAccessToken: !!accessToken,
        tuneTierUsername: tuneTierUser?.username 
      });
      
      try {
        // Only fetch Spotify playlists if we have an access token
        if (!accessToken) {
          console.log("No Spotify access token available, skipping Spotify playlist fetch");
          return;
        }
        
        const userResponse = await getCurrentUser();
        const userId = userResponse.data.id;
        _setSpotifyUserId(userId);
        const limit = 50;
        const response = await getUserPlaylists({ limit, offset: 0 });
        const items = Array.isArray(response?.data?.items) ? response.data.items : [];
        const owned = items.filter((p) => p?.owner?.id === userId);
        setPlaylists(owned);
        setFilteredPlaylists(owned);
        setOwnedOffset(items.length);
        setHasMoreOwned(!!response?.data?.next);
        console.log("Fetched Spotify playlists:", owned.length);
      } catch (err) {
        console.error("Error fetching playlists:", err);
        // Don't show error to user if it's just missing access token
        if (!accessToken || err.message?.includes('No access token')) {
          return;
        }
      }
    };
    fetchFirstPage();
  }, [accessToken, tuneTierUser]);

  const loadMoreOwned = useCallback(async () => {
    if (!hasMoreOwned || loadingMoreOwned) return;
    
    // Only fetch Spotify playlists if we have an access token
    if (!accessToken) {
      console.log("No Spotify access token available, skipping load more");
      return;
    }
    
    try {
      setLoadingMoreOwned(true);
      const limit = 50;
      const response = await getUserPlaylists({ limit, offset: ownedOffset });
      const items = Array.isArray(response?.data?.items) ? response.data.items : [];
      const owned = spotifyUserId ? items.filter((p) => p?.owner?.id === spotifyUserId) : items;
      const nextList = [...playlists, ...owned];
      setPlaylists(nextList);

      if (searchMode === "user" && !searchQuery) {
        setFilteredPlaylists(nextList);
      }
      const newOffset = ownedOffset + items.length;
      setOwnedOffset(newOffset);
      setHasMoreOwned(!!response?.data?.next && items.length > 0);
    } catch (err) {
      console.error("Error loading more playlists:", err);
      // Don't show error if it's just missing access token
      if (!accessToken || err.message?.includes('No access token')) {
        return;
      }
    } finally {
      setLoadingMoreOwned(false);
    }
  }, [hasMoreOwned, loadingMoreOwned, ownedOffset, playlists, searchMode, searchQuery, spotifyUserId, accessToken]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const lists = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key || !key.startsWith("tierlist:local:")) continue;
        const parts = key.split(":");
        if (parts.length < 3) continue;
        const localId = parts[2];
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        let saved;
        try {
          saved = JSON.parse(raw);
        } catch {
          continue;
        }
        const name =
          (saved && (saved.tierListName || (saved.state && saved.state.tierListName))) ||
          "Local Tierlist";
        const timestampSources = [
          saved?.updatedAt,
          saved?.createdAt,
          saved?.lastModified,
          saved?.state?.updatedAt,
          saved?.state?.createdAt,
          saved?.state?.lastModified
        ];
        const firstTimestamp = timestampSources.find((value) => value);
        let createdAt = 0;
        if (typeof firstTimestamp === 'number') {
          createdAt = firstTimestamp;
        } else if (typeof firstTimestamp === 'string') {
          createdAt = Date.parse(firstTimestamp) || 0;
        }

        const coverImage = saved?.coverImage
          || saved?.state?.coverImage
          || saved?.images?.[0]?.url
          || saved?.state?.images?.[0]?.url
          || '';

        const playlistLike = {
          id: localId,
          name,
          description: "Local tierlist",
          coverImage,
          owner: { display_name: "You (local)" },
          _localId: localId,
          _kind: "local-tierlist",
          createdAt
        };
        lists.push(playlistLike);
      }
      lists.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setLocalTierlists(lists);
    } catch (e) {
      console.error("Error loading local tierlists:", e);
    }
  }, []);

  useEffect(() => {
    if (searchMode === "user") {
      if (!searchQuery) {
        setFilteredPlaylists(playlists);
        return;
      }
      
      const filtered = playlists.filter(playlist => 
        playlist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (playlist.description && playlist.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (playlist.owner && playlist.owner.display_name && playlist.owner.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredPlaylists(filtered);
    }
  }, [searchQuery, playlists, searchMode]);

  

  const handleSearchModeChange = (mode) => {
    setSearchMode(mode);
  };

  const createSortedList = useCallback((lists, sortOption) => {
    if (!Array.isArray(lists)) return [];
    const clone = [...lists];
    const getName = (list) => (list?.name || "").toLowerCase();
    const getTime = (list) => (typeof list?.createdAt === "number" ? list.createdAt : 0);

    switch (sortOption) {
      case "name-desc":
        clone.sort((a, b) => getName(b).localeCompare(getName(a)));
        break;
      case "newest":
        clone.sort((a, b) => getTime(b) - getTime(a));
        break;
      case "oldest":
        clone.sort((a, b) => getTime(a) - getTime(b));
        break;
      case "name-asc":
      default:
        clone.sort((a, b) => getName(a).localeCompare(getName(b)));
        break;
    }

    return clone;
  }, []);

  const { sortedLocalTierlists, sortedOnlineTierlists } = useMemo(() => {
    const baseLocalSortOption = localSortOption === "oldest" ? "newest" : localSortOption;
    const newestFirstLocal = createSortedList(localTierlists, baseLocalSortOption);
    const resolvedLocalTierlists = localSortOption === "oldest"
      ? [...newestFirstLocal].reverse()
      : newestFirstLocal;

    return {
      sortedLocalTierlists: resolvedLocalTierlists,
      sortedOnlineTierlists: createSortedList(onlineTierlists, onlineSortOption)
    };
  }, [createSortedList, localTierlists, localSortOption, onlineTierlists, onlineSortOption]);

  const filterPlaylistsByQuery = useCallback((lists, query) => {
    if (!Array.isArray(lists) || !query) return lists || [];
    const lowered = query.toLowerCase();
    return lists.filter((playlist) => {
      if (!playlist) return false;
      const name = (playlist.name || "").toLowerCase();
      const desc = (playlist.description || "").toLowerCase();
      const owner = (playlist.owner && playlist.owner.display_name ? playlist.owner.display_name : "").toLowerCase();
      return name.includes(lowered) || desc.includes(lowered) || owner.includes(lowered);
    });
  }, []);

  let basePlaylists =
    searchMode === "user"
      ? filteredPlaylists
      : searchMode === "local"
      ? sortedLocalTierlists
      : searchMode === "online"
      ? sortedOnlineTierlists
      : [];

  if (searchMode === "online" && Array.isArray(basePlaylists)) {
    if (onlineOwnerFilter === "mine") {
      basePlaylists = basePlaylists.filter((playlist) => playlist && playlist.isOwnerSelf);
    } else if (onlineOwnerFilter === "others") {
      basePlaylists = basePlaylists.filter((playlist) => !playlist || !playlist.isOwnerSelf);
    }
  }

  let displayPlaylists = basePlaylists || [];

  if (searchMode === "local" && localSearchQuery) {
    displayPlaylists = filterPlaylistsByQuery(basePlaylists, localSearchQuery);
  }

  if (searchMode === "online" && onlineSearchQuery) {
    displayPlaylists = filterPlaylistsByQuery(basePlaylists, onlineSearchQuery);
  }

  useEffect(() => {
    if (searchMode !== "online") return;

    let cancelled = false;
    const loadOnlineTierlists = async () => {
      if (cancelled) return;
      setIsLoading(true);
      setError(null);
      try {
        const publicListsPromise = getPublicTierlists();
        let userListsPromise = Promise.resolve([]);
        
        console.log("fetchOnlineTierlists - Auth state:", { 
          hasTuneTierUser: !!tuneTierUser, 
          hasAccessToken: !!accessToken,
          tuneTierUsername: tuneTierUser?.username 
        });
        
        // Always fetch user tierlists - backend will handle both local and Spotify auth
        if (tuneTierUser || accessToken) {
          // console.log("Fetching tierlists for authenticated user(s)");
          userListsPromise = getUserTierlists();
        } else {
          // console.log("No authentication found, returning empty user lists");
        }

        const [publicLists, userLists] = await Promise.all([publicListsPromise, userListsPromise]);
        
        console.log("API Results:", { 
          publicListsCount: publicLists.length, 
          userListsCount: userLists.length,
          userListsSample: userLists.slice(0, 2).map(l => ({ name: l.tierListName, owner: l.username }))
        });

        const seen = new Set();
        const normalized = [];

        const pushNormalized = (list, isOwnerSelf) => {
          if (!list || !list.shortId || seen.has(list.shortId)) return;
          seen.add(list.shortId);
          const createdAtValue = Date.parse(list.createdAt || list.updatedAt || '') || 0;
          const coverImage = list.coverImage || list.images?.[0]?.url || '';
          normalized.push({
            id: list.shortId,
            name: list.tierListName || "Untitled Tierlist",
            description: list.description || (list.isPublic ? "Online public tierlist" : "Online private tierlist"),
            coverImage: coverImage,
            owner: {
              name: list.username,
              display_name: list.username,
              id: list.ownerUserId,
              spotifyUserHash: list.spotifyUserHash
            },
            _shortId: list.shortId,
            _kind: "online-tierlist",
            isPublic: !!list.isPublic,
            isOwnerSelf,
            createdAt: createdAtValue,
            // Include the original ownership fields for transfer detection
            spotifyUserHash: list.spotifyUserHash,
            ownerUserId: list.ownerUserId,
            username: list.username
          });
        };

        // First add user-owned tierlists so they are always marked as isOwnerSelf
        if (Array.isArray(userLists)) {
          userLists.forEach((list) => pushNormalized(list, true));
        }

        // Then add other public tierlists (duplicates are skipped by shortId)
        if (Array.isArray(publicLists)) {
          publicLists.forEach((list) => {
            // Check if this public list is actually owned by the current user
            const isOwnedByUser = userLists.some(userList => userList.shortId === list.shortId);
            pushNormalized(list, isOwnedByUser);
          });
        }

        if (!cancelled) {
          setOnlineTierlists(normalized);
        }
      } catch (err) {
        console.error("Error loading online tierlists:", err);
        if (!cancelled) {
          setError("Failed to load online tierlists");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadOnlineTierlists();

    return () => {
      cancelled = true;
    };
  }, [searchMode, tuneTierUser, accessToken, refreshTrigger]);

  const handlePlaylistClick = (playlist) => {
    if (searchMode === "local" && playlist && playlist._localId && typeof onSelectLocalTierlist === "function") {
      onSelectLocalTierlist(playlist._localId);
      return;
    }

    if (searchMode === "online" && playlist && playlist._shortId && typeof onSelectOnlineTierlist === "function") {
      onSelectOnlineTierlist(playlist._shortId);
      return;
    }

    if (typeof onSelect === "function") {
      onSelect(playlist);
    }
  };

  const updateLocalTierlistImage = useCallback((localId, imageUrl, name = null, description = null) => {
    if (typeof window === 'undefined') return;
    const storageKey = `tierlist:local:${localId}`;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (imageUrl) {
        saved.coverImage = imageUrl;
        if (saved.state) {
          saved.state.coverImage = imageUrl;
        }
      } else {
        delete saved.coverImage;
        if (saved.state && saved.state.coverImage) {
          delete saved.state.coverImage;
        }
      }
      if (name !== null) {
        saved.tierListName = name;
        if (saved.state) {
          saved.state.tierListName = name;
        }
      }
      if (description !== null) {
        saved.description = description;
        if (saved.state) {
          saved.state.description = description;
        }
      }
      window.localStorage.setItem(storageKey, JSON.stringify(saved));
      setLocalTierlists(prev => prev.map(list => (
        list?._localId === localId ? { 
          ...list, 
          coverImage: imageUrl || list.coverImage,
          name: name !== null ? name : list.name,
          description: description !== null ? description : list.description
        } : list
      )));
      return true;
    } catch (err) {
      console.error('Failed to update local tierlist', err);
      return false;
    }
  }, []);

  const updateOnlineTierlistImage = useCallback(async (playlist, imageUrl, nextIsPublic = null, name = null, description = null) => {
    if (!playlist?._shortId) return false;
    if (!tuneTierUser) {
      setError('Please log in to your account to edit online tierlists.');
      return false;
    }
    setCoverUpdatingId(playlist._shortId);
    const payload = {
      coverImage: imageUrl || ''
    };
    if (typeof nextIsPublic === 'boolean') {
      payload.isPublic = nextIsPublic;
    }
    if (name !== null) {
      payload.tierListName = name;
    }
    if (description !== null) {
      payload.description = description;
    }
    try {
      console.log('Updating online tierlist with payload:', payload);
      const response = await updateTierlist(playlist._shortId, payload);
      console.log('Backend response:', response);
      setOnlineTierlists(prev => prev.map(list => (
        list?._shortId === playlist._shortId
          ? {
              ...list,
              coverImage: imageUrl || list.coverImage,
              isPublic: typeof payload.isPublic === 'boolean' ? payload.isPublic : list.isPublic,
              name: name !== null ? name : list.name,
              description: description !== null ? description : list.description
            }
          : list
      )));
      return true;
    } catch (err) {
      console.error('Failed to update online tierlist', err);
      setError('Failed to update online tierlist.');
      return false;
    } finally {
      setCoverUpdatingId(null);
    }
  }, [tuneTierUser]);

  const handleTogglePrivacy = useCallback(async (playlist, event) => {
    event?.stopPropagation?.();
    if (!playlist?._shortId || !playlist.isOwnerSelf || privacyUpdatingId) return;
    if (!tuneTierUser) {
      setError('Please log in to your account to edit online tierlists.');
      return;
    }
    setPrivacyUpdatingId(playlist._shortId);
    try {
      const updatedDoc = await toggleTierlistPrivacy(playlist._shortId);
      setOnlineTierlists(prev => {
        const newList = prev.map(list => {
          if (list?._shortId === playlist._shortId) {
            return {
              ...list,
              isPublic: updatedDoc.isPublic,
              description: updatedDoc.isPublic ? 'Online public tierlist' : 'Online private tierlist'
            };
          }
          return list;
        });
        return newList;
      });
    } catch (err) {
      console.error('Failed to toggle tierlist privacy', err);
      setError('Failed to toggle tierlist visibility.');
    } finally {
      setPrivacyUpdatingId(null);
    }
  }, [tuneTierUser, privacyUpdatingId]);

  const resetEditModalState = useCallback(() => {
    setIsEditModalOpen(false);
    setEditModalPlaylist(null);
    setEditModalContext(null);
    setEditImageUrl("");
    setEditModalError(null);
    setUploadDisplayLabel("");
    setEditIsPublic(true);
    setEditTierlistName("");
    setEditTierlistDescription("");
  }, []);

  const openEditModal = useCallback((playlist, context) => {
    if (!playlist || !context) return;
    setEditModalPlaylist(playlist);
    setEditModalContext(context);
    const baseImage = playlist.coverImage || playlist.images?.[0]?.url || "";
    setEditImageUrl(baseImage);
    const isPublicFlag = typeof playlist.isPublic === 'boolean' ? playlist.isPublic : true;
    setEditIsPublic(isPublicFlag);
    setEditTierlistName(playlist.name || "");
    setEditTierlistDescription(playlist.description || "");
    setEditModalError(null);
    setUploadDisplayLabel(baseImage ? 'Using existing cover' : 'No image selected');
    setIsEditModalOpen(true);
  }, []);

  const fetchTierlistDataForReset = useCallback(async (playlist) => {
    if (!playlist) return null;
    try {
      if (playlist._localId) {
        if (typeof window === 'undefined') return null;
        const raw = window.localStorage.getItem(`tierlist:local:${playlist._localId}`);
        if (!raw) return null;
        return JSON.parse(raw);
      }
      if (playlist._shortId) {
        return await getTierlist(playlist._shortId);
      }
    } catch (err) {
      console.error('Failed to load tierlist data for reset', err);
    }
    return null;
  }, []);

  const computeDefaultCoverFromPlaylist = useCallback(async (playlist) => {
    const tierlistData = await fetchTierlistDataForReset(playlist);
    if (!tierlistData) return null;
    return extractFirstSongImageFromTierlist(tierlistData);
  }, [fetchTierlistDataForReset]);

  const activeModalRequestId = editModalPlaylist ? (editModalPlaylist._shortId || editModalPlaylist.id) : null;
  const isOnlineModalUpdatePending = editModalContext === 'online' && !!activeModalRequestId && coverUpdatingId === activeModalRequestId;
  const isModalBusy = editModalSubmitting || isOnlineModalUpdatePending || isProcessingUpload;

  const handleModalClose = useCallback(() => {
    if (isModalBusy) return;
    resetEditModalState();
  }, [isModalBusy, resetEditModalState]);

  const handleModalReset = useCallback(async () => {
    if (isModalBusy || !editModalPlaylist || !editModalContext) return;
    setEditModalError(null);
    setIsProcessingUpload(true);
    try {
      const defaultCover = await computeDefaultCoverFromPlaylist(editModalPlaylist);
      if (!defaultCover) {
        setUploadDisplayLabel('No default cover available');
        setEditModalError('Could not find a song cover to use by default.');
        return;
      }

      setEditImageUrl(defaultCover);
      setUploadDisplayLabel('Using first song cover');
    } catch (err) {
      console.error('Failed to compute default cover image', err);
      setEditModalError(err?.message || 'Failed to reset cover image to default.');
    } finally {
      setIsProcessingUpload(false);
    }
  }, [computeDefaultCoverFromPlaylist, editModalContext, editModalPlaylist, isModalBusy]);

  const handleModalPrivacyToggle = useCallback(() => {
    if (isModalBusy) return;
    if (!editModalPlaylist?._shortId || !editModalPlaylist?.isOwnerSelf) return;
    setEditIsPublic(prev => !prev);
  }, [editModalPlaylist, isModalBusy]);

  const handleDeleteLocalTierlist = useCallback((playlist, event, onDeleted) => {
    event?.stopPropagation?.();
    if (!playlist?._localId || typeof window === 'undefined' || deletingId) return;
    const confirmed = window.confirm(`Delete local tierlist "${playlist.name || 'Untitled'}"? This cannot be undone.`);
    if (!confirmed) return;
    const localId = playlist._localId;
    setDeletingId(localId);
    try {
      window.localStorage.removeItem(`tierlist:local:${localId}`);
      setLocalTierlists(prev => prev.filter(list => list?._localId !== localId));
      if (typeof onDeleted === 'function') {
        onDeleted();
      }
    } catch (err) {
      console.error('Failed to delete local tierlist', err);
      setError('Failed to delete local tierlist.');
    } finally {
      setDeletingId(null);
    }
  }, [deletingId]);

  const handleDeleteOnlineTierlist = useCallback(async (playlist, event, onDeleted) => {
    event?.stopPropagation?.();
    if (!playlist?._shortId || !playlist.isOwnerSelf || deletingId) return;
    const confirmed = window.confirm(`Delete online tierlist "${playlist.name || 'Untitled'}"? This cannot be undone.`);
    if (!confirmed) return;
    if (!tuneTierUser) {
      setError('Please log in to your account to delete online tierlists.');
      return;
    }
    const shortId = playlist._shortId;
    setDeletingId(shortId);
    try {
      await deleteTierlist(shortId);
      setOnlineTierlists(prev => prev.filter(list => list?._shortId !== shortId));
      if (typeof onDeleted === 'function') {
        onDeleted();
      }
    } catch (err) {
      console.error('Failed to delete online tierlist', err);
      setError('Failed to delete online tierlist.');
    } finally {
      setDeletingId(null);
    }
  }, [deletingId, tuneTierUser]);

  const handleFileUploadChange = useCallback(async (event) => {
    const input = event.target;
    if (isModalBusy) {
      if (input) input.value = '';
      return;
    }
    const file = input?.files?.[0];
    if (!file) return;
    setIsProcessingUpload(true);
    setEditModalError(null);
    try {
      const resizedDataUrl = await downscaleImageToLimit(file, MAX_UPLOAD_BYTES);
      setEditImageUrl(resizedDataUrl);
      setUploadDisplayLabel(file.name ? `Uploaded: ${file.name}` : 'Custom image selected');
    } catch (err) {
      console.error('Failed to process uploaded image', err);
      setEditModalError(err?.message || 'Failed to process that image. Please try another file.');
    } finally {
      if (input) input.value = '';
      setIsProcessingUpload(false);
    }
  }, [isModalBusy]);

  const handleUploadButtonClick = useCallback(() => {
    if (isModalBusy) return;
    fileUploadInputRef.current?.click();
  }, [isModalBusy]);

  const handleEditModalSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (!editModalPlaylist || !editModalContext || isModalBusy) return;
    setEditModalError(null);
    setEditModalSubmitting(true);
    const normalizedValue = editImageUrl || null;
    const nameValue = editTierlistName.trim() || null;
    const descriptionValue = editTierlistDescription.trim() || null;
    
    // Add length validation
    if (nameValue && nameValue.length > 100) {
      setEditModalError('Tierlist name must be 100 characters or less.');
      setEditModalSubmitting(false);
      return;
    }
    if (descriptionValue && descriptionValue.length > 300) {
      setEditModalError('Description must be 300 characters or less.');
      setEditModalSubmitting(false);
      return;
    }
    
    let success = false;
    try {
      if (editModalContext === 'local' && editModalPlaylist._localId) {
        success = updateLocalTierlistImage(editModalPlaylist._localId, normalizedValue, nameValue, descriptionValue);
      } else if (editModalContext === 'online' && editModalPlaylist._shortId) {
        success = await updateOnlineTierlistImage(editModalPlaylist, normalizedValue, editIsPublic, nameValue, descriptionValue);
      }
    } catch (err) {
      console.error('Failed to persist tierlist changes', err);
      success = false;
    } finally {
      setEditModalSubmitting(false);
    }

    if (success) {
      resetEditModalState();
    } else {
      setEditModalError('Failed to update tierlist. Please try again.');
    }
  }, [editModalPlaylist, editModalContext, editImageUrl, editTierlistName, editTierlistDescription, editIsPublic, isModalBusy, resetEditModalState, updateLocalTierlistImage, updateOnlineTierlistImage]);

  const handleEditCoverClick = useCallback((playlist, event) => {
    event.stopPropagation();
    if (!playlist) return;
    const context = playlist._localId ? 'local' : playlist._shortId ? 'online' : null;
    if (!context) return;
    if (context === 'online' && !playlist.isOwnerSelf) {
      return;
    }
    openEditModal({ ...playlist }, context);
  }, [openEditModal]);

  const handleTransferOwnership = useCallback(async (playlist) => {
    if (!playlist._shortId || !tuneTierUser || !accessToken) {
      return;
    }
    
    // Detect ownership correctly: local playlist lacks spotifyUserHash, spotify playlist has it
    // Check the actual fields available in the playlist object
    const hasSpotifyHash = playlist.spotifyUserHash !== undefined && playlist.spotifyUserHash !== null;
    const hasOwnerUserId = playlist.ownerUserId !== undefined && playlist.ownerUserId !== null;
    
    const isSpotifyOwned = hasSpotifyHash && !hasOwnerUserId;
    const isLocalOwned = hasOwnerUserId && !hasSpotifyHash;
    
    // Debug: Log ownership detection
    // console.log('Ownership detection:', {
    //   isSpotifyOwned,
    //   isLocalOwned,
    //   hasSpotifyHash,
    //   hasOwnerUserId,
    //   spotifyUserHash: playlist.spotifyUserHash,
    //   ownerUserId: playlist.ownerUserId,
    //   ownerObject: playlist.owner,
    //   allPlaylistKeys: Object.keys(playlist)
    // });
    
    const isOwnedByCurrentUser = playlist.isOwnerSelf;
    if (!isSpotifyOwned && !isLocalOwned && isOwnedByCurrentUser) {
      // If we can't determine ownership from fields, don't proceed
      return;
    } else if (!isSpotifyOwned && !isLocalOwned) {
      return;
    }
    
    // Create dynamic confirmation message based on transfer direction
    let direction, targetName, currentOwnerName;
    
    // Debug: Log the owner object specifically and its contents
    // console.log('Transfer playlist owner object:', playlist.owner);
    // console.log('Owner object keys:', playlist.owner ? Object.keys(playlist.owner) : 'No owner object');
    // console.log('Owner name:', playlist.owner?.name);
    // console.log('Full playlist object keys:', Object.keys(playlist));
    
    // Get current owner name from playlist data - use owner object structure
    if (playlist.owner && typeof playlist.owner === 'object' && playlist.owner.display_name && typeof playlist.owner.display_name === 'string' && playlist.owner.display_name.trim()) {
      currentOwnerName = playlist.owner.display_name;
    } else if (playlist.username && typeof playlist.username === 'string' && playlist.username.trim()) {
      currentOwnerName = playlist.username;
    } else if (playlist.owner && typeof playlist.owner === 'string') {
      currentOwnerName = playlist.owner;
    } else {
      currentOwnerName = 'Unknown';
    }
    
    // console.log('Detected owner name:', currentOwnerName);
    
    if (isSpotifyOwned) {
      direction = 'from Spotify to your TuneTier account';
      targetName = tuneTierUser.username;
    } else {
      direction = 'from your TuneTier account to Spotify';
      // Get actual Spotify username from auth data
      targetName = 'your Spotify account'; // Will be updated below
    }
    
    // Get Spotify username from auth data for better target name
    if (!isSpotifyOwned && accessToken) {
      // Get actual Spotify username from API
      try {
        const { getSpotifyUserInfo } = await import('../utils/backendApi.js');
        const spotifyUserInfo = await getSpotifyUserInfo();
        if (spotifyUserInfo && spotifyUserInfo.displayName) {
          targetName = spotifyUserInfo.displayName;
          // console.log('Using Spotify username from API:', targetName);
        } else {
          // console.log('No Spotify user info available from API');
        }
      } catch (err) {
        // console.log('Could not get Spotify username from API:', err);
      }
    }
    
    const confirmed = window.confirm(`Transfer "${playlist.name}" ${direction}? This will change the displayed creator from "${currentOwnerName}" to "${targetName}".`);
    if (!confirmed) {
      return;
    }
    
    try {
      console.log('Attempting transfer...');
      const result = await Promise.race([
        transferTierlistOwnership(playlist._shortId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Transfer timeout')), 10000))
      ]);
      
      console.log('Transfer successful:', result);
      
      // Update the online tierlists state to show new ownership immediately
      setOnlineTierlists(prev => prev.map(p => 
        p.id === playlist._shortId 
          ? { 
              ...p, 
              username: result.username,
              ownerUserId: result.ownerUserId,
              spotifyUserHash: result.spotifyUserHash,
              owner: {
                ...p.owner,
                name: result.username,
                display_name: result.username,
                id: result.ownerUserId,
                spotifyUserHash: result.spotifyUserHash
              },
              // Keep isOwnerSelf as true since user owns both accounts
              isOwnerSelf: true
            }
          : p
      ));
      
      // No need to refresh from database - we already have the updated data
      // The UI will show the new username immediately
    } catch (err) {
      console.error('Failed to transfer ownership:', err);
      console.error('Error details:', err.message, err.stack);
      setError('Failed to transfer ownership. Please try again.');
    }
  }, [tuneTierUser, accessToken]);

  const handleDeleteTierlist = useCallback(() => {
    if (!editModalPlaylist || !editModalContext || isModalBusy) return;
    
    if (editModalContext === 'local' && editModalPlaylist._localId) {
      handleDeleteLocalTierlist(editModalPlaylist, null, () => {
        handleModalClose();
      });
    } else if (editModalContext === 'online' && editModalPlaylist._shortId && editModalPlaylist.isOwnerSelf) {
      handleDeleteOnlineTierlist(editModalPlaylist, null, () => {
        handleModalClose();
      });
    }
  }, [editModalPlaylist, editModalContext, isModalBusy, handleDeleteLocalTierlist, handleDeleteOnlineTierlist, handleModalClose]);

  const modalPreviewUrl = editImageUrl.trim() || editModalPlaylist?.coverImage || editModalPlaylist?.images?.[0]?.url || '/assets/placeholder.png';

  return (
    <>
    <div className="playlist-selector-container">
      <h2>Select a Playlist</h2>
      
      <div className="search-mode-toggle">
        <div className="desktop-mode-toggle">
          <button 
            className={`toggle-btn ${searchMode === "online" ? "active" : ""}`}
            onClick={() => handleSearchModeChange("online")}
          >
            Online Playlists
          </button>
          <button 
            className={`toggle-btn ${searchMode === "local" ? "active" : ""}`}
            onClick={() => handleSearchModeChange("local")}
          >
            Local Playlists
          </button>
          <button 
            className={`toggle-btn ${searchMode === "import" ? "active" : ""}`}
            onClick={() => handleSearchModeChange("import")}
          >
            Import Playlist (CSV)
          </button>
          <button 
            className={`toggle-btn ${searchMode === "user" ? "active" : ""}`}
            onClick={() => handleSearchModeChange("user")}
          >
            My Playlists
          </button>
        </div>
        <div className="mobile-mode-toggle">
          <button 
            className={`toggle-btn ${searchMode === "online" ? "active" : ""}`}
            onClick={() => handleSearchModeChange("online")}
          >
            Online
          </button>
          <button 
            className={`toggle-btn ${searchMode === "local" ? "active" : ""}`}
            onClick={() => handleSearchModeChange("local")}
          >
            Local
          </button>
          <button 
            className={`toggle-btn ${searchMode === "import" ? "active" : ""}`}
            onClick={() => handleSearchModeChange("import")}
          >
            Import
          </button>
          <button 
            className={`toggle-btn ${searchMode === "user" ? "active" : ""}`}
            onClick={() => handleSearchModeChange("user")}
          >
            My Playlists
          </button>
        </div>
      </div>

      {searchMode === "user" && (
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search your playlists..."
            value={searchQuery}
            ref={searchInputRef}
            onKeyDown={(e) => {
              if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
                checkKonamiCode(e.key.toLowerCase());
              }
            }}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}
      
      {searchMode === "local" && (
        <div className="search-input-wrapper">
          <div className="desktop-search-layout">
            <input
              type="text"
              className="search-input desktop-search-input"
              placeholder="Search your local tierlists..."
              value={localSearchQuery}
              onKeyDown={(e) => {
                if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
                  checkKonamiCode(e.key.toLowerCase());
                }
              }}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
            />
            <div className="desktop-filters">
              <select
                className="sort-select"
                value={localSortOption}
                onChange={(e) => setLocalSortOption(e.target.value)}
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
          </div>
          <div className="mobile-search-filters">
            <input
              type="text"
              className="search-input mobile-search-input"
              placeholder="Search your local tierlists..."
              value={localSearchQuery}
              onKeyDown={(e) => {
                if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
                  checkKonamiCode(e.key.toLowerCase());
                }
              }}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
            />
            <select
              className="mobile-filter-select"
              value={localSortOption}
              onChange={(e) => setLocalSortOption(e.target.value)}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>
      )}
      {searchMode === "online" && (
        <div className="search-input-wrapper">
          <div className="desktop-search-layout">
            <input
              type="text"
              className="search-input desktop-search-input"
              placeholder="Search online tierlists..."
              value={onlineSearchQuery}
              onKeyDown={(e) => {
                if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
                  checkKonamiCode(e.key.toLowerCase());
                }
              }}
              onChange={(e) => setOnlineSearchQuery(e.target.value)}
            />
            <div className="desktop-filters">
              <select
                className="sort-select owner-filter-select"
                value={onlineOwnerFilter}
                onChange={(e) => setOnlineOwnerFilter(e.target.value)}
              >
                <option value="mine">Only My Tierlists</option>
                <option value="others">Others&apos; Tierlists</option>
                <option value="all">All Tierlists</option>
              </select>
              <select
                className="sort-select"
                value={onlineSortOption}
                onChange={(e) => setOnlineSortOption(e.target.value)}
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
          </div>
          <div className="mobile-search-filters">
            <input
              type="text"
              className="search-input mobile-search-input"
              placeholder="Search online tierlists..."
              value={onlineSearchQuery}
              onKeyDown={(e) => {
                if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
                  checkKonamiCode(e.key.toLowerCase());
                }
              }}
              onChange={(e) => setOnlineSearchQuery(e.target.value)}
            />
            <select
              className="mobile-filter-select"
              value={onlineOwnerFilter}
              onChange={(e) => setOnlineOwnerFilter(e.target.value)}
            >
              <option value="mine">Only My Tierlists</option>
              <option value="others">Others&apos; Tierlists</option>
              <option value="all">All Tierlists</option>
            </select>
            <select
              className="mobile-filter-select"
              value={onlineSortOption}
              onChange={(e) => setOnlineSortOption(e.target.value)}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {searchMode === "user" && !accessToken && (
        <div className="my-playlists-login-prompt">
          <p>Log in with Spotify to see your playlists.</p>
          <p className="my-playlists-login-note">
            Spotify restricts how many users can use this app. Login here only works if you have been approved. If you have not been approved, use Online Playlists.
          </p>
          <AuthButton />
        </div>
      )}

      {searchMode === "import" && (
        <CSVImportSelector onSelectImported={onSelectImported} />
      )}

      <div className="playlist-grid">
        {displayPlaylists && displayPlaylists.length > 0 ? displayPlaylists.map((playlist) => {
          // Skip null playlists
          if (!playlist) return null;
          
          // Get image URL safely
          const fallbackImage = pickBestSongImageUrl(playlist.images);
          const imageUrl = playlist.coverImage
            || fallbackImage
            || '/assets/placeholder.png';
          
          // Get owner display name safely
          const ownerName = playlist.owner && playlist.owner.display_name ? 
                           playlist.owner.display_name : 
                           'Unknown';
          
          const playlistKey = playlist._shortId 
            ? `${playlist._shortId}-${playlist.isPublic ? 'public' : 'private'}`
            : playlist._localId 
            ? `local-${playlist._localId}`
            : playlist.id || Math.random().toString();
          
          const canEditCover = (searchMode === 'local' && playlist._localId) || (searchMode === 'online' && playlist._shortId && playlist.isOwnerSelf);
          const canDeleteLocal = searchMode === 'local' && playlist._localId;
          const canDeleteOnline = searchMode === 'online' && playlist._shortId && playlist.isOwnerSelf;
          const isDeleting = deletingId === playlist._localId || deletingId === playlist._shortId;

          return (
            <button
              key={playlistKey}
              className="playlist-button"
              onClick={() => handlePlaylistClick(playlist)}
            >
              {canEditCover ? (
                <button
                  type="button"
                  className="playlist-edit-button"
                  disabled={coverUpdatingId === playlist.id || coverUpdatingId === playlist._shortId}
                  onClick={(event) => handleEditCoverClick(playlist, event)}
                  aria-label="Edit cover image"
                >
                  <img src="/assets/edit.svg" alt="Edit" />
                </button>
              ) : null}
              {(canDeleteLocal || canDeleteOnline) ? (
                <button
                  type="button"
                  className="playlist-delete-button"
                  disabled={isDeleting}
                  onClick={(event) =>
                    canDeleteLocal
                      ? handleDeleteLocalTierlist(playlist, event)
                      : handleDeleteOnlineTierlist(playlist, event)
                  }
                  aria-label="Delete tierlist"
                >
                  {isDeleting ? '…' : '🗑️'}
                </button>
              ) : null}
              <div className="playlist-cover-wrapper">
                {searchMode === 'online' && playlist._shortId && playlist.isOwnerSelf ? (
                  <button
                    type="button"
                    className={`playlist-privacy-button ${playlist.isPublic ? 'public' : 'private'}`}
                    disabled={privacyUpdatingId === playlist._shortId}
                    onClick={(event) => handleTogglePrivacy(playlist, event)}
                    aria-label={playlist.isPublic ? 'Set tierlist private' : 'Set tierlist public'}
                  >
                    <img src={playlist.isPublic ? '/assets/public.svg' : '/assets/private.svg'} alt="" aria-hidden="true" />
                  </button>
                ) : null}
                {/* Transfer ownership button - only show when both auths are present */}
                {searchMode === 'online' && playlist._shortId && tuneTierUser && accessToken && playlist.isOwnerSelf && (
                  <button
                    type="button"
                    className="playlist-transfer-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleTransferOwnership(playlist);
                    }}
                    title={playlist.ownerUserId ? "Transfer to Spotify account" : "Transfer to TuneTier account"}
                    aria-label="Transfer ownership"
                  >
                    ⇄
                  </button>
                )}
                <img
                  src={imageUrl}
                  alt={playlist.name || 'Playlist'}
                  className="playlist-cover"
                />
              </div>
              <div className="playlist-info">
                <h3 className="playlist-name">{playlist.name || 'Untitled Playlist'}</h3>
                <p className="playlist-creator">Created by: {ownerName}</p>
                <p className="playlist-description">
                  {playlist.description ? decodeHtmlEntities(playlist.description) : 'No description available'}
                </p>
              </div>
            </button>
          );
        }) : null}
      </div>
      {searchMode === "user" && hasMoreOwned && (
        <div className="load-more-container">
          <button
            type="button"
            className="load-more-button"
            onClick={loadMoreOwned}
            disabled={loadingMoreOwned}
          >
            {loadingMoreOwned ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
    {isEditModalOpen && (
      <div className="cover-edit-modal-overlay" role="dialog" aria-modal="true">
        <div className="cover-edit-modal">
          <button
            type="button"
            className="modal-close-button"
            onClick={handleModalClose}
            disabled={isModalBusy}
            aria-label="Close edit tierlist modal"
          >
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
          <h3>Edit tierlist</h3>
          <p className="modal-subtitle">{editModalPlaylist?.name || 'Untitled playlist'}</p>
          {editModalPlaylist?._shortId && editModalPlaylist?.isOwnerSelf && (
            <div className="modal-privacy-toggle" role="group" aria-label="Tierlist visibility">
              <span className="modal-label">Visibility</span>
              <button
                type="button"
                className={`privacy-toggle ${editIsPublic ? 'public' : 'private'}`}
                onClick={handleModalPrivacyToggle}
                disabled={isModalBusy}
              >
                <img
                  src={editIsPublic ? '/assets/public.svg' : '/assets/private.svg'}
                  alt={editIsPublic ? 'Public tierlist' : 'Private tierlist'}
                />
                <span>{editIsPublic ? 'Public (anyone with the link can view)' : 'Private (only you can view)'}</span>
              </button>
            </div>
          )}
          <form onSubmit={handleEditModalSubmit} className="cover-edit-form">
            <div className="modal-form-content">
              <div className="modal-form-left">
                <div className="modal-upload-control">
                  <label className="modal-label" htmlFor="cover-image-upload-display">Upload a new cover</label>
                  <div className="modal-input-with-upload">
                    <input
                      id="cover-image-upload-display"
                      type="text"
                      value={uploadDisplayLabel || 'No image selected'}
                      readOnly
                      disabled={isModalBusy}
                      className="modal-input"
                    />
                    <button
                      type="button"
                      className="modal-upload-button"
                      onClick={handleUploadButtonClick}
                      disabled={isModalBusy}
                    >
                      <img src="/assets/upload.svg" alt="" aria-hidden="true" />
                      <span>Upload</span>
                    </button>
                  </div>
                  <input
                    id="cover-image-upload"
                    ref={fileUploadInputRef}
                    type="file"
                    accept="image/*"
                    className="modal-file-input-hidden"
                    onChange={handleFileUploadChange}
                    disabled={isModalBusy}
                  />
                  <p className="modal-helper-text">Uploads are capped at 100KB; larger images are automatically resized to fit.</p>
                </div>
                <div className="modal-preview">
                  <div className="modal-preview-square">
                    <img src={modalPreviewUrl} alt="Cover preview" />
                  </div>
                </div>
              </div>
              <div className="modal-form-right">
                <div className="modal-text-control">
                  <label className="modal-label" htmlFor="tierlist-name">Tierlist Name</label>
                  <input
                    id="tierlist-name"
                    type="text"
                    value={editTierlistName}
                    onChange={(e) => setEditTierlistName(e.target.value)}
                    disabled={isModalBusy}
                    className="modal-input"
                    placeholder="Enter tierlist name"
                    maxLength={100}
                  />
                  <div className="modal-char-count">
                    {editTierlistName.length}/100
                  </div>
                </div>
                <div className="modal-text-control">
                  <label className="modal-label" htmlFor="tierlist-description">Description</label>
                  <textarea
                    id="tierlist-description"
                    value={editTierlistDescription}
                    onChange={(e) => setEditTierlistDescription(e.target.value)}
                    disabled={isModalBusy}
                    className="modal-input modal-textarea"
                    placeholder="Enter description (optional)"
                    rows={5}
                    maxLength={300}
                  />
                  <div className="modal-char-count">
                    {editTierlistDescription.length}/300
                  </div>
                  <div className="modal-actions">
                    <div className="modal-button-row">
                      {((editModalContext === 'local' && editModalPlaylist?._localId) ||
                        (editModalContext === 'online' && editModalPlaylist?._shortId && editModalPlaylist?.isOwnerSelf)) && (
                        <button
                          type="button"
                          className="modal-button danger"
                          onClick={handleDeleteTierlist}
                          disabled={isModalBusy}
                        >
                          Delete tierlist
                        </button>
                      )}
                      <button
                        type="button"
                        className="modal-button refresh"
                        onClick={handleModalReset}
                        disabled={isModalBusy}
                      >
                        Reset to default
                      </button>
                    </div>
                    <div className="modal-button-row">
                      <button
                        type="button"
                        className="modal-button secondary"
                        onClick={handleModalClose}
                        disabled={isModalBusy}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="modal-button primary"
                        disabled={isModalBusy}
                      >
                        {isModalBusy ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {editModalError && <div className="modal-error">{editModalError}</div>}
          </form>
        </div>
      </div>
    )}
  </>
);
};

export default PlaylistSelector;
