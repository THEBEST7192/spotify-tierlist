import React, { useState, useEffect } from 'react';
import { getTierlistRatings, rateTierlist, removeTierlistRating } from '../utils/backendApi';
import './TierlistRating.css';

const TierlistRating = ({ shortId, tuneTierUser, initialRatings }) => {
  const [ratings, setRatings] = useState(initialRatings || null);
  const [userRating, setUserRating] = useState(initialRatings?.userRating || null);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(null);

  // Update ratings when initialRatings prop changes
  useEffect(() => {
    if (initialRatings) {
      setRatings(initialRatings);
      setUserRating(initialRatings.userRating);
    }
  }, [initialRatings]);

  // Only fetch on mount if no initial ratings provided
  useEffect(() => {
    if (!shortId || initialRatings) return;
    fetchRatings();
  }, [shortId, initialRatings]);

  const fetchRatings = async () => {
    try {
      const data = await getTierlistRatings(shortId);
      setRatings(data);
      setUserRating(data.userRating);
    } catch (err) {
      console.error('Error fetching ratings:', err);
    }
  };

  const handleRatingClick = async (rating, event) => {
    // Stop event propagation to prevent opening the tierlist
    if (event) {
      event.stopPropagation();
    }

    if (!tuneTierUser) {
      alert('Please log in to rate tierlists');
      return;
    }

    if (userRating === rating) {
      // Remove rating if clicking the same rating
      handleRemoveRating(event);
      return;
    }

    setIsLoading(true);
    try {
      await rateTierlist(shortId, rating);
      setUserRating(rating);
      await fetchRatings();
    } catch (err) {
      console.error('Error submitting rating:', err);
      alert('Failed to submit rating');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveRating = async (event) => {
    // Stop event propagation to prevent opening the tierlist
    if (event) {
      event.stopPropagation();
    }

    if (!tuneTierUser) return;
    
    setIsLoading(true);
    try {
      await removeTierlistRating(shortId);
      setUserRating(null);
      await fetchRatings();
    } catch (err) {
      console.error('Error removing rating:', err);
      alert('Failed to remove rating');
    } finally {
      setIsLoading(false);
    }
  };

  if (!ratings) {
    return null;
  }

  const renderStars = () => {
    const stars = [];
    // Stars always reflect the average rating; the user's own rating is shown via the active highlight
    const avgRating = ratings.averageRating || 0;
    
    for (let i = 1; i <= 5; i++) {
      let fillPercentage = 0;
      
      if (i <= Math.floor(avgRating)) {
        fillPercentage = 100;
      } else if (i === Math.ceil(avgRating) && avgRating % 1 !== 0) {
        fillPercentage = (avgRating % 1) * 100;
      }
      
      const isHovered = hoveredRating != null && i <= hoveredRating;
      const isActive = userRating === i;

      stars.push(
        <button
          key={i}
          type="button"
          className={`rating-star ${fillPercentage === 100 ? 'filled' : ''} ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
          disabled={isLoading || !tuneTierUser}
          onClick={(e) => handleRatingClick(i, e)}
          onMouseEnter={() => setHoveredRating(i)}
          onMouseLeave={() => setHoveredRating(null)}
          aria-label={`Rate ${i} stars`}
        >
          <span className="star-base" aria-hidden="true">★</span>
          <span className="star-fill" style={{ width: `${fillPercentage}%` }} aria-hidden="true">★</span>
        </button>
      );
    }
    return stars;
  };

  return (
    <div className="tierlist-rating">
      <div className="rating-stars">
        {renderStars()}
      </div>
      <div className="rating-stats">
        {ratings.averageRating > 0 ? (
          <span className="rating-average">
            {ratings.averageRating.toFixed(1)}
          </span>
        ) : null}
        <span className="rating-count">
          ({ratings.totalRatings})
        </span>
      </div>
    </div>
  );
};

export default TierlistRating;
