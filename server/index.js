/*
 * WARNING: This file is a thin wrapper around the legacy FlowVoIP backend that still resides one level above.
 * Once you have physically moved `main.js` and the other backend modules into this `server/` directory,
 * update the require path below to `./main.js` and remove this notice.
 */

// eslint-disable-next-line no-console
console.log('[FlowVoIP] Starting server...');

// IMPORTANT: The actual server implementation is still located in the parent directory.
// This keeps the old implementation intact while complying with the new `/root/app/server` structure expectation.
// To finish the migration simply move all backend files into this folder and update the path below.
require('../main.js');