import { authenticateClerk } from '../plugins/clerk-auth.js';
import { ValidationError } from '../lib/errors.js';
import { 
  getImageUrl, 
  getPersonDetails, 
  getPersonCombinedCredits,
  searchPeople,
  getShowCredits,
  getMovieCredits
} from '../lib/tmdb.js';
import type { FastifyInstance } from 'fastify';

export const peopleRoutes = async (fastify: FastifyInstance) => {
  
  // Search for people
  fastify.get('/api/people/search', { preHandler: authenticateClerk }, 
    async (request, reply) => {
      const { q, page = 1 } = request.query as { q?: string; page?: number };
      
      if (!q || q.trim().length === 0) {
        throw new ValidationError('Search query is required');
      }
      
      const results = await searchPeople(q, Number(page));
      
      return {
        results: results.results.map((person: any) => ({
          tmdb_person_id: person.id,
          name: person.name,
          profile_url: getImageUrl(person.profile_path, 'w185'),
          known_for_department: person.known_for_department,
          known_for: person.known_for,
        })),
        page: results.page,
        total_pages: results.total_pages,
        total_results: results.total_results,
      };
    }
  );

  // Get person's filmography from TMDB
  fastify.get('/api/people/:tmdb_id', { preHandler: authenticateClerk }, 
    async (request, reply) => {
      const { tmdb_id } = request.params as { tmdb_id: string };
      const tmdbId = parseInt(tmdb_id);
      
      // Fetch person details and credits from TMDB
      const [personDetails, credits] = await Promise.all([
        getPersonDetails(tmdbId),
        getPersonCombinedCredits(tmdbId)
      ]);
      
      // Group crew by department
      const crewByDepartment = (credits.crew || []).reduce((acc: any, credit: any) => {
        const dept = credit.department || 'Other';
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push({
          ...credit,
          poster_url: getImageUrl(credit.poster_path),
          backdrop_url: getImageUrl(credit.backdrop_path),
        });
        return acc;
      }, {});
      
      return {
        id: personDetails.id,
        name: personDetails.name,
        profile_url: getImageUrl(personDetails.profile_path, 'w185'),
        biography: personDetails.biography,
        birthday: personDetails.birthday,
        place_of_birth: personDetails.place_of_birth,
        known_for_department: personDetails.known_for_department,
        cast: (credits.cast || []).map((c: any) => ({
          ...c,
          poster_url: getImageUrl(c.poster_path),
          backdrop_url: getImageUrl(c.backdrop_path),
        })),
        crew_by_department: crewByDepartment,
      };
    }
  );

  // Get credits for a specific content item (by TMDB ID)
  fastify.get('/api/content/:type/:tmdb_id/credits', { preHandler: authenticateClerk }, 
    async (request, reply) => {
      const { type, tmdb_id } = request.params as { type: 'show' | 'movie'; tmdb_id: string };
      const tmdbId = parseInt(tmdb_id);
      
      // Validate type
      if (type !== 'show' && type !== 'movie') {
        throw new ValidationError('Type must be either "show" or "movie"');
      }
      
      // Fetch credits from TMDB
      const credits = type === 'show'
        ? await getShowCredits(tmdbId)
        : await getMovieCredits(tmdbId);
      
      return {
        cast: (credits.cast || []).slice(0, 30).map((c: any) => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profile_url: getImageUrl(c.profile_path, 'w185'),
          order: c.order,
        })),
        crew: (credits.crew || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          job: c.job,
          department: c.department,
          profile_url: getImageUrl(c.profile_path, 'w185'),
        })),
      };
    }
  );
};

