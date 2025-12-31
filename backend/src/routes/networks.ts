import { db } from '../db/index.js';
import { authenticate } from '../plugins/auth.js';
import { NotFoundError } from '../lib/errors.js';
import { getImageUrl, discoverShowsByNetwork } from '../lib/tmdb.js';
import type { FastifyInstance } from 'fastify';

export const networkRoutes = async (fastify: FastifyInstance) => {
  // Get all featured networks
  fastify.get('/api/networks', { preHandler: authenticate }, async (request, reply) => {
    const networks = await db
      .selectFrom('networks')
      .selectAll()
      .orderBy('name', 'asc')
      .execute();
    
    return networks.map(network => ({
      ...network,
      logo_url: getImageUrl(network.logo_path, 'w154'),
    }));
  });

  // Get network details
  fastify.get('/api/networks/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const network = await db
      .selectFrom('networks')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    
    if (!network) {
      throw new NotFoundError('Network not found');
    }
    
    return {
      ...network,
      logo_url: getImageUrl(network.logo_path, 'w154'),
    };
  });

  // Get shows from a specific network
  fastify.get('/api/networks/:id/content', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { page = 1 } = request.query as { page?: number };
    
    const network = await db
      .selectFrom('networks')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    
    if (!network) {
      throw new NotFoundError('Network not found');
    }
    
    if (!network.tmdb_network_id) {
      throw new Error('Network does not have a TMDB ID');
    }
    
    // Get content from TMDB
    const tmdbContent = await discoverShowsByNetwork(
      network.tmdb_network_id, 
      Number(page)
    );
    
    // Format results
    const formattedResults = tmdbContent.results.map((show: any) => ({
      id: show.id,
      tmdb_id: show.id,
      title: show.name || show.title,
      poster_url: getImageUrl(show.poster_path, 'w342'),
      backdrop_url: getImageUrl(show.backdrop_path, 'w1280'),
      overview: show.overview,
      first_air_date: show.first_air_date,
      vote_average: show.vote_average,
      vote_count: show.vote_count,
      content_type: 'show',
    }));
    
    return {
      network: {
        ...network,
        logo_url: getImageUrl(network.logo_path, 'w154'),
      },
      content: formattedResults,
      page: tmdbContent.page,
      total_pages: tmdbContent.total_pages,
      total_results: tmdbContent.total_results,
    };
  });
};

