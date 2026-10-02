const path = require('node:path');
const { existsSync } = require('node:fs');
const {
  applicationDefault,
  cert,
  getApps,
  initializeApp
} = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

function initializeFirebase() {
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    throw new Error('FIREBASE_DATABASE_URL must be configured.');
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : path.join(__dirname, 'serviceAccountKey.json');
  const credential = existsSync(serviceAccountPath)
    ? cert(require(serviceAccountPath))
    : applicationDefault();
  const app = getApps()[0] || initializeApp({ credential, databaseURL });

  return {
    auth: getAuth(app),
    db: getDatabase(app)
  };
}

module.exports = { initializeFirebase };
