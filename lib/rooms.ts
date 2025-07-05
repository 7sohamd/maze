// A singleton in-memory store shared by all route files.
// NOTE: This resets when the dev server restarts or the function is re-loaded.
// For production use a real DB or Redis.
export const rooms: Map<string, any> = new Map()
