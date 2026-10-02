require('dotenv').config();
const { initializeFirebase } = require('./firebase');

async function bootstrapAdmin() {
  const uid = process.argv[2];
  if (!uid || process.argv.length !== 3) {
    throw new Error('Usage: npm run bootstrap-admin -- <firebase-auth-uid>');
  }

  const { auth } = initializeFirebase();
  const user = await auth.getUser(uid);
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    const anotherAdminExists = page.users.some((account) =>
      account.uid !== uid
      && !account.disabled
      && account.customClaims?.role === 'system_admin'
    );
    if (anotherAdminExists || user.customClaims?.role === 'system_admin') {
      throw new Error('An active system administrator already exists; use the admin API to manage roles.');
    }
    pageToken = page.pageToken;
  } while (pageToken);

  await auth.setCustomUserClaims(uid, {
    ...user.customClaims,
    role: 'system_admin'
  });
  console.log(`Granted the system_admin role to Firebase user ${uid}.`);
}

bootstrapAdmin().catch((error) => {
  console.error('Unable to bootstrap system administrator:', error.code || error.message);
  process.exitCode = 1;
});
