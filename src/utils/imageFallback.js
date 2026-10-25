import { vinylDataUri, randomPlaceholderColor } from './vinylGenerator';

// External image URLs that failed to load this session
const failedImageUrls = new Set();

export const hasImageFailed = (url) => failedImageUrls.has(url);

// img onError handler that replaces a broken cover with a vinyl record
export const makeVinylFallback = (color, exclude) => (event) => {
  const img = event.target;
  if (img.dataset.vinylFallback) return;
  img.dataset.vinylFallback = '1';
  const failedUrl = img.getAttribute('src') || img.src;
  if (failedUrl) failedImageUrls.add(failedUrl);
  img.src = vinylDataUri(color || randomPlaceholderColor(exclude));
};
