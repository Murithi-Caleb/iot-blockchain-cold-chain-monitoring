const admin = require('firebase-admin');

// Initialize using the same credentials you set up earlier
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Your exact UID
const targetUid = 'jfU4GXYa12ceL5yFfp8BKdBZPS93';

async function forceAdmin() {
  try {
    console.log(`Forcing system_admin role on user: ${targetUid}...`);
    // Retrieve any existing claims so we don't accidentally delete them
    const userRecord = await admin.auth().getUser(targetUid);
    const currentClaims = userRecord.customClaims || {};
    
    // Set the new admin claim
    await admin.auth().setCustomUserClaims(targetUid, { 
        ...currentClaims, 
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