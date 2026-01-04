/**
 * Test helpers for API integration tests
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

export interface TestUser {
  email: string;
  password: string;
  token?: string;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Headers;
}

/**
 * Make an authenticated API request
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit & { token?: string } = {}
): Promise<ApiResponse<T>> {
  const { token, ...fetchOptions } = options;
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  
  const headers = new Headers(fetchOptions.headers as HeadersInit);
  headers.set('Content-Type', 'application/json');
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  
  return {
    data,
    status: response.status,
    headers: response.headers,
  };
}

/**
 * Register a new user
 */
export async function registerUser(
  email: string,
  password: string
): Promise<ApiResponse<{ token?: string; user?: any }>> {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Login and get token
 */
export async function loginUser(
  email: string,
  password: string
): Promise<ApiResponse<{ token?: string }>> {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Authenticate user (register or login)
 */
export async function authenticateUser(
  email: string = 'toonami@test.com',
  password: string = 'password123'
): Promise<string> {
  // Try to register first
  const registerResponse = await registerUser(email, password);
  
  if (registerResponse.data.token) {
    return registerResponse.data.token;
  }
  
  // If registration fails (user exists), try login
  const loginResponse = await loginUser(email, password);
  
  if (!loginResponse.data.token) {
    throw new Error('Failed to authenticate user');
  }
  
  return loginResponse.data.token;
}

/**
 * Fetch and cache content from TMDB
 */
export async function fetchContent(
  tmdbId: number,
  token: string
): Promise<ApiResponse<{ id: string; tmdb_id: number; title: string }>> {
  return apiRequest(`/api/content/${tmdbId}`, {
    method: 'GET',
    token,
  });
}

/**
 * Fetch episodes for content
 */
export async function fetchEpisodes(
  tmdbId: number,
  token: string,
  season?: number
): Promise<ApiResponse<any[]>> {
  const url = season 
    ? `/api/content/${tmdbId}/episodes?season=${season}`
    : `/api/content/${tmdbId}/episodes`;
  
  return apiRequest(url, {
    method: 'GET',
    token,
  });
}

/**
 * Add content to queue
 */
export async function addToQueue(
  contentId: string,
  token: string
): Promise<ApiResponse<any>> {
  return apiRequest('/api/queue', {
    method: 'POST',
    token,
    body: JSON.stringify({ content_id: contentId }),
  });
}

/**
 * Get queue
 */
export async function getQueue(token: string): Promise<ApiResponse<any[]>> {
  return apiRequest('/api/queue', {
    method: 'GET',
    token,
  });
}

/**
 * Clear queue
 */
export async function clearQueue(token: string): Promise<ApiResponse> {
  return apiRequest('/api/queue', {
    method: 'DELETE',
    token,
  });
}

/**
 * Generate schedule from queue
 */
export async function generateScheduleFromQueue(
  options: {
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    timeSlotDuration?: number;
    maxShowsPerTimeSlot?: number;
    includeReruns?: boolean;
    rerunFrequency?: string;
    rotationType?: string;
  },
  token: string
): Promise<ApiResponse<{ count: number; schedule: any[] }>> {
  return apiRequest('/api/schedule/generate/queue', {
    method: 'POST',
    token,
    body: JSON.stringify({
      start_date: options.startDate,
      end_date: options.endDate,
      start_time: options.startTime,
      end_time: options.endTime,
      time_slot_duration: options.timeSlotDuration ?? 30,
      max_shows_per_time_slot: options.maxShowsPerTimeSlot ?? 1,
      include_reruns: options.includeReruns ?? false,
      rerun_frequency: options.rerunFrequency ?? 'rarely',
      rotation_type: options.rotationType ?? 'round_robin',
    }),
  });
}

/**
 * Generate schedule from show IDs
 */
export async function generateScheduleFromShows(
  showIds: string[],
  options: {
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    rotationType?: string;
  },
  token: string
): Promise<ApiResponse<{ count: number; schedule: any[] }>> {
  return apiRequest('/api/schedule/generate/shows', {
    method: 'POST',
    token,
    body: JSON.stringify({
      show_ids: showIds,
      start_date: options.startDate,
      end_date: options.endDate,
      start_time: options.startTime,
      end_time: options.endTime,
      rotation_type: options.rotationType ?? 'round_robin',
    }),
  });
}

/**
 * Get schedule for date range
 */
export async function getSchedule(
  startDate: string,
  endDate: string,
  token: string
): Promise<ApiResponse<any[]>> {
  return apiRequest(`/api/schedule?start=${startDate}&end=${endDate}`, {
    method: 'GET',
    token,
  });
}

/**
 * Delete schedule items for date range
 */
export async function deleteScheduleForDateRange(
  startDate: string,
  endDate: string,
  token: string
): Promise<{ deleted: number; failed: number }> {
  const scheduleResponse = await getSchedule(startDate, endDate, token);
  
  if (!Array.isArray(scheduleResponse.data) || scheduleResponse.data.length === 0) {
    return { deleted: 0, failed: 0 };
  }
  
  const scheduleIds = scheduleResponse.data
    .map((item: any) => item.id)
    .filter((id: any) => id != null && id !== '');
  
  let deleted = 0;
  let failed = 0;
  
  for (const scheduleId of scheduleIds) {
    const deleteResponse = await apiRequest(`/api/schedule/${scheduleId}`, {
      method: 'DELETE',
      token,
    });
    
    if (deleteResponse.status === 200) {
      deleted++;
    } else {
      failed++;
    }
  }
  
  return { deleted, failed };
}

/**
 * Get library
 */
export async function getLibrary(token: string): Promise<ApiResponse<any[]>> {
  return apiRequest('/api/content/library', {
    method: 'GET',
    token,
  });
}



