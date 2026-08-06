// Non-obvious staff-only base path. Used in place of the old /pos so the POS
// surface doesn't show up to customers/bots scanning common routes. The auth
// gate is still the real protection — this is just hygiene.
//
// Lives in its own module (rather than App.jsx) so api/axios.js can read it
// without importing App.jsx, which imports the axios client in turn.
export const STAFF_BASE = '/anfal-staff-x7k2';
