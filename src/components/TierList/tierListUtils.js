import html2canvas from "html2canvas";

// Define default tiers and their colors
export const DEFAULT_TIERS = {
  S: { color: "#FF7F7F", label: "S" },
  A: { color: "#FFBF7F", label: "A" },
  B: { color: "#FFFF7F", label: "B" },
  C: { color: "#7FFF7F", label: "C" },
  D: { color: "#7FBFFF", label: "D" },
  E: { color: "#BF7FFF", label: "E" },
  F: { color: "#FF7FBF", label: "F" },
  Unranked: { color: "#E0E0E0", label: "Unranked" }
};

// Define the default order of tiers
export const DEFAULT_TIER_ORDER = ["S", "A", "B", "C", "D", "E", "F", "Unranked"];

export const pickPreferredPlaylistImage = (images = []) => {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const exact300 = images.find((img) => Number(img?.width) === 300 || Number(img?.height) === 300);
  if (exact300) {
    return exact300;
  }

  if (images[1]) {
    return images[1];
  }

  return images[0];
};

// IMPORTANT: This is the most reliable ID method
export const getItemStyle = (isDragging, draggableStyle) => ({
  // some basic styles to make the items look nicer
  userSelect: "none",
  padding: 8,
  margin: "0 8px 0 0",

  // change background colour if dragging
  background: isDragging ? "#333" : "#191414", // Spotify black
  color: "white", // Text color for readability on black background

  // styles we need to apply on draggables
  ...draggableStyle
});

export const getListStyle = isDraggingOver => ({
  background: isDraggingOver ? "rgba(255, 255, 255, 0.1)" : "transparent",
  display: "flex",
  flexWrap: "wrap",
  overflow: "auto",
  minHeight: "80px",
  alignContent: "flex-start"
});

export const computeShareUrl = (shortId) => {
  if (!shortId || typeof window === 'undefined') return '';
  return `${window.location.origin}/tierlists/${shortId}`;
};

// Check for songs that cannot be played (no preview_url and no Spotify link)
export const checkForUnavailableSongs = (tracks) => {
  const unavailable = [];

  Object.entries(tracks).forEach(([tierName, tierSongs]) => {
    tierSongs.forEach((song) => {
      const content = song.content || song; // Handle both formats
      if (content && content.type === 'track' && !content.preview_url && !content.external_urls?.spotify) {
        unavailable.push({
          id: content.id || content.dragId, // Use track ID or dragId as fallback
          name: content.name,
          artist: content.artists?.[0]?.name || 'Unknown Artist',
          tier: tierName
        });
      }
    });
  });

  return unavailable;
};

// Export tier list as an image
export const exportTierListImage = (name) => {
  // Wait for images to load
  const images = document.querySelectorAll('.album-cover');
  const promises = Array.from(images).map(img => {
    return new Promise((resolve) => {
      if (img.complete) {
        resolve();
      } else {
        img.onload = resolve;
        img.onerror = resolve; // Resolve even if image fails to load
      }
    });
  });

  Promise.all(promises).then(() => {
    // Create a temporary container for the tier list
    const tempContainer = document.createElement('div');
    const tierList = document.getElementById("tier-list").cloneNode(true);

    // Ensure all images have CORS support
    const clonedImages = tierList.querySelectorAll('.album-cover');
    clonedImages.forEach(img => {
      img.crossOrigin = "Anonymous";
      img.loading = "eager";
      img.style.opacity = '1'; // Ensure images are visible
    });

    tempContainer.appendChild(tierList);
    document.body.appendChild(tempContainer);

    // Generate the image
    html2canvas(tempContainer, {
      useCORS: true,
      logging: true,
      scale: 2, // Higher quality image
      onclone: (doc) => {
        // Ensure images are loaded in the cloned document
        const docImages = doc.querySelectorAll('.album-cover');
        docImages.forEach(img => {
          img.crossOrigin = "Anonymous";
          img.loading = "eager";
        });
      }
    }).then(canvas => {
      // Clean up
      tempContainer.remove();

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      const filename = name ?
        `${name.replace(/[^a-z0-9-]/gi, '_').toLowerCase()}.png` :
        'spotify-tierlist.png';
      link.download = filename;
      link.click();
    });
  });
};
