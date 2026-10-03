const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('./serviceAccountKey.json');

// Check if app is already initialized
if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

// Your exact UID
const targetUid = 'jfU4GXYa12ceL5yFfp8BKdBZPS93';

async function forceAdmin() {
  try {
    console.log(`Forcing system_admin role on user: ${targetUid}...`);
    
    // Retrieve any existing claims so we don't accidentally delete them
    const userRecord = await getAuth().getUser(targetUid);
    const currentClaims = userRecord.customClaims || {};
    
    // Set the admin claims. The backend authorizes on the `role` claim (see
    // adminRouter.js requireSystemAdmin), so `role` is required; the legacy boolean
    // flag is kept so existing frontend checks continue to work.
    await getAuth().setCustomUserClaims(targetUid, {
        ...currentClaims,
        role: 'system_admin',
        system_admin: true
    });
    
    console.log("✅ Success! The account is now a System Administrator.");
  } catch (error) {
    console.error("❌ Error setting claims:", error);
  } finally {
    process.exit();
  }
}

forceAdmin();