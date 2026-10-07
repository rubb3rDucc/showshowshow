/**
 * Unit tests for the anime provider -> neutral title detail mapper
 */

import { describe, it, expect } from 'vitest';
import {
  animeDisplayTitle,
  animeOriginalTitle,
  animeBackdropUrl,
  cleanSynopsis,
  flipName,
  mapAnimeCast,
  mapAnimeCrew,
  mapAnimeRelations,
  mapAnimeRecommendations,
  animeToTitleDetail,
  applyEnglishTitles,
  walkSeasonChain,
  chainToSeasons,
  titleKey,
  type TitleLookup,
} from '../../src/lib/anime-detail.js';

describe('anime detail mapper', () => {
  describe('titles', () => {
    const frieren = { title: 'Sousou no Frieren', title_english: "Frieren: Beyond Journey's End" };

    it('shows the English title and keeps the romaji as the original', () => {
      expect(animeDisplayTitle(frieren)).toBe("Frieren: Beyond Journey's End");
      expect(animeOriginalTitle(frieren)).toBe('Sousou no Frieren');
    });

    it('has no original title when there is no separate English one', () => {
      const bebop = { title: 'Cowboy Bebop', title_english: 'Cowboy Bebop' };
      expect(animeDisplayTitle(bebop)).toBe('Cowboy Bebop');
      expect(animeOriginalTitle(bebop)).toBeNull();
      expect(animeOriginalTitle({ title: 'Mushishi' })).toBeNull();
    });
  });

  describe('animeBackdropUrl', () => {
    it('uses the trailer thumbnail, else null', () => {
      expect(
        animeBackdropUrl({ trailer: { images: { maximum_image_url: 'https://img.youtube.com/vi/a/maxresdefault.jpg' } } })
      ).toBe('https://img.youtube.com/vi/a/maxresdefault.jpg');
      expect(animeBackdropUrl({ trailer: { images: {} } })).toBeNull();
      expect(animeBackdropUrl({})).toBeNull();
    });
  });

  describe('cleanSynopsis', () => {
    it("drops MAL's rewrite credit and keeps other text", () => {
      expect(cleanSynopsis('Spike must choose.\n\n[Written by MAL Rewrite]')).toBe('Spike must choose.');
      expect(cleanSynopsis('A plot. (Source: ANN)')).toBe('A plot. (Source: ANN)');
      expect(cleanSynopsis('[Written by MAL Rewrite]')).toBeNull();
      expect(cleanSynopsis(null)).toBeNull();
    });
  });

  describe('flipName', () => {
    it('turns "Last, First" into "First Last" and leaves single names alone', () => {
      expect(flipName('Ichinose, Kana')).toBe('Kana Ichinose');
      expect(flipName('Frieren')).toBe('Frieren');
    });
  });

  describe('mapAnimeCast', () => {
    const va = (name: string, language = 'Japanese') => ({ language, person: { name } });

    it('leads with main characters, most favorited first, credited to the Japanese voice actor', () => {
      const cast = mapAnimeCast([
        { role: 'Supporting', favorites: 9000, character: { name: 'Aura' }, voice_actors: [va('Taketatsu, Ayana')] },
        { role: 'Main', favorites: 10, character: { name: 'Fern' }, voice_actors: [va('Ichinose, Kana')] },
        {
          role: 'Main',
          favorites: 500,
          character: { name: 'Frieren' },
          voice_actors: [va('Mallow, Mallorie', 'English'), va('Tanezaki, Atsumi')],
        },
      ]);

      expect(cast).toEqual([
        { person_id: null, name: 'Atsumi Tanezaki', role: 'Frieren' },
        { person_id: null, name: 'Kana Ichinose', role: 'Fern' },
        { person_id: null, name: 'Ayana Taketatsu', role: 'Aura' },
      ]);
    });

    it('falls back to the character when there is no Japanese voice actor', () => {
      const cast = mapAnimeCast([{ role: 'Supporting', character: { name: 'Owner, Bakery' }, voice_actors: [] }]);
      expect(cast).toEqual([{ person_id: null, name: 'Bakery Owner', role: null }]);
    });
  });

  describe('mapAnimeCrew', () => {
    it('keeps key roles only, once each, director first', () => {
      const crew = mapAnimeCrew([
        { person: { mal_id: 1, name: 'Call, Evan' }, positions: ['Music', 'Theme Song Arrangement (ED1)'] },
        { person: { mal_id: 2, name: 'Saitou, Keiichirou' }, positions: ['Director', 'Storyboard (eps 1, 11)'] },
        { person: { mal_id: 2, name: 'Saitou, Keiichirou' }, positions: ['Director'] },
        { person: { mal_id: 3, name: 'Aoki, Haruka' }, positions: ['Producer'] },
      ]);

      expect(crew).toEqual([
        { person_id: null, name: 'Keiichirou Saitou', role: 'Director', department: 'Directing' },
        { person_id: null, name: 'Evan Call', role: 'Music', department: 'Sound' },
      ]);
    });
  });

  describe('mapAnimeRelations', () => {
    it('labels and orders relations, drops noise, and links manga out', () => {
      const relations = mapAnimeRelations({
        relations: [
          { relation: 'Adaptation', entry: [{ type: 'manga', mal_id: 126287, name: 'Sousou no Frieren', url: 'https://myanimelist.net/manga/126287' }] },
          { relation: 'Other', entry: [{ type: 'anime', mal_id: 56805, name: 'Yuusha' }] },
          { relation: 'Sequel', entry: [{ type: 'anime', mal_id: 59978, name: 'Sousou no Frieren 2nd Season' }] },
          { relation: 'Prequel', entry: [{ type: 'anime', mal_id: 1, name: 'Before' }] },
        ],
      });

      expect(relations.map((r) => r.label)).toEqual(['Prequel', 'Sequel', 'Based on']);
      expect(relations[1].entries[0]).toEqual({
        media: 'anime',
        id: 59978,
        title: 'Sousou no Frieren 2nd Season',
        original_title: null,
        external_url: null,
      });
      expect(relations[2].entries[0]).toMatchObject({ media: 'manga', external_url: 'https://myanimelist.net/manga/126287' });
    });

    it('returns nothing when the provider has no relations', () => {
      expect(mapAnimeRelations({})).toEqual([]);
    });
  });

  describe('mapAnimeRecommendations', () => {
    const rec = (mal_id: number, votes: number, image: string | null = `https://cdn/${mal_id}.jpg`) => ({
      votes,
      entry: { mal_id, title: `Title ${mal_id}`, images: { jpg: { large_image_url: image } } },
    });

    it('orders by votes and skips titles without a poster', () => {
      const recs = mapAnimeRecommendations([rec(1, 5), rec(2, 30), rec(3, 99, null)]);
      expect(recs.map((r) => r.mal_id)).toEqual([2, 1]);
      expect(recs[0]).toMatchObject({ tmdb_id: null, poster_url: 'https://cdn/2.jpg', data_source: 'jikan' });
    });
  });

  describe('applyEnglishTitles', () => {
    it('swaps in English titles, keeps the romaji as the original, and leaves unknowns alone', () => {
      const relations = mapAnimeRelations({
        relations: [
          {
            relation: 'Sequel',
            entry: [
              { type: 'anime', mal_id: 59978, name: 'Sousou no Frieren 2nd Season' },
              { type: 'anime', mal_id: 7, name: 'Unresolved' },
            ],
          },
          { relation: 'Adaptation', entry: [{ type: 'manga', mal_id: 126287, name: 'Sousou no Frieren', url: 'u' }] },
        ],
      });
      const recs = mapAnimeRecommendations([
        { votes: 1, entry: { mal_id: 52701, title: 'Dungeon Meshi', images: { jpg: { large_image_url: 'p' } } } },
      ]);
      const lookup: TitleLookup = new Map([
        [titleKey('anime', 59978), { title: 'Sousou no Frieren 2nd Season', title_english: "Frieren: Beyond Journey's End Season 2" }],
        [titleKey('manga', 126287), { title: 'Sousou no Frieren', title_english: "Frieren: Beyond Journey's End" }],
        [titleKey('anime', 52701), { title: 'Dungeon Meshi', title_english: 'Delicious in Dungeon' }],
      ]);

      const out = applyEnglishTitles(relations, recs, lookup);

      expect(out.relations[0].entries).toMatchObject([
        { title: "Frieren: Beyond Journey's End Season 2", original_title: 'Sousou no Frieren 2nd Season' },
        { title: 'Unresolved', original_title: null },
      ]);
      expect(out.relations[1].entries[0]).toMatchObject({ media: 'manga', title: "Frieren: Beyond Journey's End" });
      expect(out.recommendations[0]).toMatchObject({ title: 'Delicious in Dungeon', title_english: 'Delicious in Dungeon' });
    });
  });

  describe('season chain', () => {
    // A Demon Slayer-shaped chain: S1 has two sequels (a movie and its TV arc), both leading to S2
    const db: Record<number, any> = {
      1: { mal_id: 1, type: 'TV', episodes: 26, title_english: 'Demon Slayer', relations: [
        { relation: 'Sequel', entry: [{ type: 'anime', mal_id: 2 }, { type: 'anime', mal_id: 4 }] },
        { relation: 'Side Story', entry: [{ type: 'anime', mal_id: 9 }] },
      ] },
      2: { mal_id: 2, type: 'Movie', episodes: 1, title_english: 'Demon Slayer: Mugen Train', relations: [
        { relation: 'Prequel', entry: [{ type: 'anime', mal_id: 1 }] },
        { relation: 'Sequel', entry: [{ type: 'manga', mal_id: 77 }, { type: 'anime', mal_id: 3 }] },
      ] },
      4: { mal_id: 4, type: 'TV', episodes: 7, title_english: 'Demon Slayer: Mugen Train Arc', relations: [
        { relation: 'Prequel', entry: [{ type: 'anime', mal_id: 1 }] },
        { relation: 'Sequel', entry: [{ type: 'anime', mal_id: 3 }] },
      ] },
      3: { mal_id: 3, type: 'TV', episodes: 11, title_english: 'Demon Slayer: Entertainment District Arc', relations: [
        { relation: 'Prequel', entry: [{ type: 'anime', mal_id: 4 }] },
      ] },
    };
    const getAnime = async (id: number) => db[id];

    it('walks both directions from any entry, preferring the TV sequel and ignoring manga and side stories', async () => {
      expect((await walkSeasonChain(db[1], getAnime)).map((a) => a.mal_id)).toEqual([1, 4, 3]);
      expect((await walkSeasonChain(db[3], getAnime)).map((a) => a.mal_id)).toEqual([1, 4, 3]);
    });

    it('follows a movie when it is the only link', async () => {
      const viaMovie = { ...db[1], relations: [{ relation: 'Sequel', entry: [{ type: 'anime', mal_id: 2 }] }] };
      expect((await walkSeasonChain(viaMovie, getAnime)).map((a) => a.mal_id)).toEqual([1, 2, 3]);
    });

    it('stops on cycles', async () => {
      const loop = { mal_id: 5, type: 'TV', relations: [{ relation: 'Sequel', entry: [{ type: 'anime', mal_id: 5 }] }] };
      expect((await walkSeasonChain(loop, async () => loop)).map((a) => a.mal_id)).toEqual([5]);
    });

    it('labels TV seasons by what the title adds and skips movies', () => {
      expect(chainToSeasons([db[1], db[2], db[3]])).toEqual([
        { mal_id: 1, label: 'Season 1', episodes: 26 },
        { mal_id: 3, label: 'Entertainment District Arc', episodes: 11 },
      ]);
    });

    it('has no picker for a single season', () => {
      expect(chainToSeasons([db[1], db[2]])).toEqual([]);
    });
  });

  describe('animeToTitleDetail', () => {
    it('hides non-genre tags and caps streaming links', () => {
      const detail = animeToTitleDetail({
        title: 'Sousou no Frieren',
        genres: [{ name: 'Adventure' }, { name: 'Award Winning' }],
        studios: [{ name: 'Madhouse' }],
        streaming: ['a', 'b', 'c', 'd', 'e'].map((n) => ({ name: n, url: `https://${n}` })),
      });

      expect(detail.genres).toEqual(['Adventure']);
      expect(detail.studios).toEqual(['Madhouse']);
      expect(detail.streaming).toHaveLength(4);
      expect(detail.cast).toEqual([]);
    });
  });
});
