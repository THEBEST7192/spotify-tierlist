import { vinylDataUri, randomPlaceholderColor } from './vinylGenerator';

// img onError handler that replaces a broken cover with a vinyl record
export const makeVinylFallback = (color, exclude) => (event) => {
  const img = event.target;
  if (img.dataset.vinylFallback) return;
  img.dataset.vinylFallback = '1';
  img.src = vinylDataUri(color || randomPlaceholderColor(exclude));
};
