/**
 * Get a GIF URL for a show/movie title using Giphy API
 * Falls back to a placeholder if API key is not available
 */

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || '';
const GIPHY_API_URL = 'https://api.giphy.com/v1/gifs/search';

/**
 * Search for a GIF related to the title
 * @param title - Show or movie title
 * @returns GIF URL or null
 */
export async function getGifForTitle(title: string): Promise<string | null> {
  if (!title || !GIPHY_API_KEY) {
    return null;
  }

  try {
    // Clean up title for search (remove special characters, limit length)
    const searchQuery = title
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 3)
      .join(' ');

    const response = await fetch(
      `${GIPHY_API_URL}?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchQuery)}&limit=1&rating=g&lang=en`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      // Return the fixed_height_downsampled URL for better performance
      return data.data[0].images?.fixed_height_downsampled?.url || 
             data.data[0].images?.fixed_height?.url ||
             data.data[0].images?.original?.url ||
             null;
    }

    return null;
  } catch (error) {
    console.warn('Failed to fetch GIF:', error);
    return null;
  }
}


