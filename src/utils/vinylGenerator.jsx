import React from 'react';
import { PLACEHOLDER_COLORS } from '../constants';

// Picks a random placeholder color, optionally filtering out specific colors
export const randomPlaceholderColor = (exclude = []) => {
  const pool = exclude.length
    ? PLACEHOLDER_COLORS.filter(c => !exclude.includes(c))
    : PLACEHOLDER_COLORS;
  return pool[Math.floor(Math.random() * pool.length)];
};

// Vinyl record as a React component for inline rendering
export const VinylSvg = ({ color = '#1DB954', className, width, height }) => (
  <svg
    viewBox="0 0 256 256"
    className={className}
    {...(width != null ? { width } : {})}
    {...(height != null ? { height } : {})}
  >
    <circle cx="127.5" cy="128.5" r="95.5" fill={color} />
    <circle cx="127.5" cy="128.5" r="23.875" fill="black" />
    <circle cx="127.5" cy="128.5" r="7.95833" fill={color} />
  </svg>
);

// Vinyl record as a data URI for img src attributes and onError fallbacks
export const vinylDataUri = (color = '#1DB954') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><circle cx="127.5" cy="128.5" r="95.5" fill="${color}"/><circle cx="127.5" cy="128.5" r="23.875" fill="black"/><circle cx="127.5" cy="128.5" r="7.95833" fill="${color}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};
