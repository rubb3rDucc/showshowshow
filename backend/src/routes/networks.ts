import { db } from '../db/index.js';
import { authenticate } from '../plugins/auth.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { getImageUrl, discoverShowsByNetwork, searchNetworks, getNetworkDetails } from '../lib/tmdb.js';
import type { FastifyInstance } from 'fastify';

export const networkRoutes = async (fastify: FastifyInstance) => {
  // Get all featured networks
  fastify.get('/api/networks', { preHandler: authenticate }, async (request, reply) => {
    const networks = await db
      .selectFrom('networks')
      .selectAll()
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc') // Secondary sort by name
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
    
    // Get content from TMDB (pass is_provider flag to use correct endpoint)
    const tmdbContent = await discoverShowsByNetwork(
      network.tmdb_network_id, 
      Number(page),
      network.is_provider
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
      media_type: 'tv', // Explicitly mark as TV to prevent movie/show confusion
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

  // Search for networks in TMDB
  // Searches both TV networks and streaming providers
  fastify.get('/api/networks/search', { preHandler: authenticate }, async (request, reply) => {
    const { q, page = 1 } = request.query as { q?: string; page?: number };
    
    if (!q || q.trim().length === 0) {
      throw new ValidationError('Search query is required');
    }
    
    const query = q.toLowerCase();
    const results: any[] = [];
    const seenIds = new Set<number>();
    
    try {
      // Method 1: Search for TV shows with the query, then extract networks
      // This is more accurate for actual TV networks
      const searchEndpoint = `/search/tv?query=${encodeURIComponent(q)}&page=${Number(page)}`;
      const searchResults: any = await fetch(
        `https://api.themoviedb.org/3${searchEndpoint}&api_key=${process.env.TMDB_API_KEY}`
      ).then(res => res.json());
      
      // Extract unique networks from the search results
      for (const show of (searchResults.results || []).slice(0, 10)) { // Limit to first 10 shows
        try {
          const showDetails: any = await fetch(
            `https://api.themoviedb.org/3/tv/${show.id}?api_key=${process.env.TMDB_API_KEY}`
          ).then(res => res.json());
          
          if (showDetails.networks && showDetails.networks.length > 0) {
            for (const network of showDetails.networks) {
              // Filter by query match and only add networks with logos
              if (network.logo_path && 
                  network.name.toLowerCase().includes(query) &&
                  !seenIds.has(network.id)) {
                seenIds.add(network.id);
                results.push({
                  tmdb_id: network.id,
                  name: network.name,
                  logo_path: network.logo_path,
                  logo_url: getImageUrl(network.logo_path, 'w154'),
                  origin_country: network.origin_country,
                  is_provider: false, // This is a TV network
                });
              }
            }
          }
        } catch (error) {
          // Skip shows that fail to fetch
          continue;
        }
      }
    } catch (error) {
      console.error('Error searching TV shows:', error);
    }
    
    try {
      // Method 2: Get streaming providers
      // Only add these if we haven't found many networks yet
      if (results.length < 5) {
        const allProviders: any = await fetch(
          `https://api.themoviedb.org/3/watch/providers/tv?api_key=${process.env.TMDB_API_KEY}&watch_region=US`
        ).then(res => res.json());
        
        // Filter providers that match the query
        if (allProviders.results) {
          for (const provider of allProviders.results) {
            if (provider.provider_name.toLowerCase().includes(query) && 
                provider.logo_path &&
                !seenIds.has(provider.provider_id)) {
              seenIds.add(provider.provider_id);
              results.push({
                tmdb_id: provider.provider_id,
                name: provider.provider_name,
                logo_path: provider.logo_path,
                logo_url: getImageUrl(provider.logo_path, 'w154'),
                origin_country: 'US',
                is_provider: true, // This is a streaming provider
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching streaming providers:', error);
    }
    
    return {
      results: results,
      page: 1,
      total_pages: 1,
      total_results: results.length,
    };
  });

  // Add a new network to the database
  fastify.post('/api/networks', { preHandler: authenticate }, async (request, reply) => {
    const { tmdb_network_id, is_provider } = request.body as { tmdb_network_id: number; is_provider?: boolean };
    
    if (!tmdb_network_id) {
      throw new ValidationError('TMDB network ID is required');
    }
    
    const isProviderFlag = is_provider ?? false;
    
    // Check if network already exists with the same type
    const existing = await db
      .selectFrom('networks')
      .selectAll()
      .where('tmdb_network_id', '=', tmdb_network_id)
      .where('is_provider', '=', isProviderFlag)
      .executeTakeFirst();
    
    if (existing) {
      return {
        ...existing,
        logo_url: getImageUrl(existing.logo_path, 'w154'),
        already_exists: true,
      };
    }
    
    // Fetch network details from TMDB (pass isProvider flag)
    const networkDetails = await getNetworkDetails(tmdb_network_id, isProviderFlag);
    
    // Get the highest sort_order and add 1
    const maxSortOrder = await db
      .selectFrom('networks')
      .select(db.fn.max('sort_order').as('max_sort'))
      .executeTakeFirst();
    
    const nextSortOrder = (maxSortOrder?.max_sort ?? -1) + 1;
    
    // Insert into database
    const newNetwork = await db
      .insertInto('networks')
      .values({
        id: crypto.randomUUID(),
        tmdb_network_id: networkDetails.id,
        name: networkDetails.name,
        logo_path: networkDetails.logo_path,
        origin_country: networkDetails.origin_country,
        sort_order: nextSortOrder,
        is_provider: isProviderFlag,
        created_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    
    return {
      ...newNetwork,
      logo_url: getImageUrl(newNetwork.logo_path, 'w154'),
      already_exists: false,
    };
  });

  // Delete a network from the database
  fastify.delete('/api/networks/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const network = await db
      .selectFrom('networks')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    
    if (!network) {
      throw new NotFoundError('Network not found');
    }
    
    // Delete the network (content_networks will cascade delete)
    await db
      .deleteFrom('networks')
      .where('id', '=', id)
      .execute();
    
    return { success: true, deleted_network: network.name };
  });

  // Reorder networks
  fastify.patch('/api/networks/reorder', { preHandler: authenticate }, async (request, reply) => {
    const { network_ids } = request.body as { network_ids: string[] };
    
    if (!network_ids || !Array.isArray(network_ids)) {
      throw new ValidationError('network_ids array is required');
    }
    
    // Update sort_order for each network
    await Promise.all(
      network_ids.map((id, index) =>
        db
          .updateTable('networks')
          .set({ sort_order: index })
          .where('id', '=', id)
          .execute()
      )
    );
    
    return { success: true };
  });
};

