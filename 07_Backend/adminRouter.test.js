const { once } = require('node:events');
const { afterEach, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./server');

function makeUser(uid, role, overrides = {}) {
  return {
    uid,
    email: `${uid}@example.test`,
    displayName: uid,
    disabled: false,
    emailVerified: true,
    customClaims: { role },
    metadata: {
      creationTime: '2026-01-01T00:00:00.000Z',
      lastSignInTime: '2026-01-02T00:00:00.000Z'
    },
    ...overrides
  };
}

function createFakeAuth(initialUsers) {
  const users = new Map(initialUsers.map((user) => [user.uid, structuredClone(user)]));
  const tokens = new Map([
    ['admin-token', { uid: 'admin-1', email: 'admin-1@example.test', role: 'system_admin' }],
    ['operator-token', { uid: 'operator-1', email: 'operator-1@example.test', role: 'supply_chain_operator' }]
  ]);
  let nextUserId = 1;
  const revokedUsers = [];

  function getUserOrThrow(uid) {
    const user = users.get(uid);
    if (!user) {
      const error = new Error('User not found.');
      error.code = 'auth/user-not-found';
      throw error;
    }
    return user;
  }

  return {
    users,
    revokedUsers,
    async verifyIdToken(token, checkRevoked) {
      assert.equal(checkRevoked, true);
      const decodedToken = tokens.get(token);
      if (!decodedToken) {
        const error = new Error('Invalid token.');
        error.code = 'auth/invalid-id-token';
        throw error;
      }
      return decodedToken;
    },
    async listUsers(maxResults, pageToken) {
      assert.equal(maxResults, 1000);
      assert.equal(pageToken, undefined);
      return { users: [...users.values()] };
    },
    async createUser(properties) {
      const user = makeUser(`created-${nextUserId++}`, undefined, {
        email: properties.email,
        displayName: properties.displayName,
        emailVerified: false
      });
      users.set(user.uid, user);
      return structuredClone(user);
    },
    async setCustomUserClaims(uid, customClaims) {
      getUserOrThrow(uid).customClaims = structuredClone(customClaims);
    },
    async revokeRefreshTokens(uid) {
      revokedUsers.push(uid);
    },
    async getUser(uid) {
      return structuredClone(getUserOrThrow(uid));
    },
    async updateUser(uid, properties) {
      const user = getUserOrThrow(uid);
      Object.assign(user, properties);
      return structuredClone(user);
    },
    async deleteUser(uid) {
      getUserOrThrow(uid);
      users.delete(uid);
    }
  };
}

let server;
let request;
let auth;
let databaseWrites;

beforeEach(async () => {
  auth = createFakeAuth([
    makeUser('admin-1', 'system_admin'),
    makeUser('admin-2', 'system_admin'),
    makeUser('operator-1', 'supply_chain_operator')
  ]);
  databaseWrites = [];
  const db = {
    ref(path) {
      return {
        async set(value) {
          databaseWrites.push({ path, value });
        }
      };
    }
  };
  server = createApp({ auth, db }).listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  request = (path, { token, ...options } = {}) => fetch(`http://127.0.0.1:${port}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
});

afterEach(async () => {
  server.close();
  await once(server, 'close');
});

describe('System Admin API', () => {
  it('requires a valid system administrator for admin and batch-management routes', async () => {
    const missingToken = await request('/api/admin/users');
    assert.equal(missingToken.status, 401);

    const currentUserResponse = await request('/api/auth/me', { token: 'admin-token' });
    assert.equal(currentUserResponse.status, 200);
    assert.equal((await currentUserResponse.json()).data.role, 'system_admin');

    const invalidToken = await request('/api/admin/users', { token: 'invalid-token' });
    assert.equal(invalidToken.status, 401);

    const operatorRequest = await request('/api/admin/users', { token: 'operator-token' });
    assert.equal(operatorRequest.status, 403);

    const batchRequest = await request('/api/batches', {
      token: 'operator-token',
      method: 'POST',
      body: JSON.stringify({
        produce_type: 'Avocado',
        quantity: 10,
        source_location: 'Nairobi'
      })
    });
    assert.equal(batchRequest.status, 403);
    assert.equal(databaseWrites.length, 0);
  });

  it('provisions, lists, updates, and deletes users without returning their password', async () => {
    const createResponse = await request('/api/admin/users', {
      token: 'admin-token',
      method: 'POST',
      body: JSON.stringify({
        email: 'new-user@example.test',
        display_name: 'New User',
        password: 'a-long-test-password',
        role: 'supply_chain_operator'
      })
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.data.email, 'new-user@example.test');
    assert.equal(created.data.role, 'supply_chain_operator');
    assert.equal(Object.hasOwn(created.data, 'password'), false);

    const uid = created.data.uid;
    const listResponse = await request('/api/admin/users', { token: 'admin-token' });
    assert.equal(listResponse.status, 200);
    const listed = await listResponse.json();
    assert.ok(listed.data.some((user) => user.uid === uid));

    const updateResponse = await request(`/api/admin/users/${uid}`, {
      token: 'admin-token',
      method: 'PATCH',
      body: JSON.stringify({ role: 'authorized_traceability_user', disabled: true })
    });
    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json();
    assert.equal(updated.data.role, 'authorized_traceability_user');
    assert.equal(updated.data.disabled, true);
    assert.deepEqual(auth.revokedUsers, [uid]);

    const deleteResponse = await request(`/api/admin/users/${uid}`, {
      token: 'admin-token',
      method: 'DELETE'
    });
    assert.equal(deleteResponse.status, 204);
    assert.equal(auth.users.has(uid), false);
  });

  it('prevents administrators from demoting, disabling, or deleting their own account', async () => {
    await auth.deleteUser('admin-2');

    const demoteResponse = await request('/api/admin/users/admin-1', {
      token: 'admin-token',
      method: 'PATCH',
      body: JSON.stringify({ role: 'supply_chain_operator' })
    });
    assert.equal(demoteResponse.status, 409);

    const disableResponse = await request('/api/admin/users/admin-1', {
      token: 'admin-token',
      method: 'PATCH',
      body: JSON.stringify({ disabled: true })
    });
    assert.equal(disableResponse.status, 409);

    const deleteResponse = await request('/api/admin/users/admin-1', {
      token: 'admin-token',
      method: 'DELETE'
    });
    assert.equal(deleteResponse.status, 409);
    assert.equal(auth.users.has('admin-1'), true);
  });

  it('keeps batch registration admin-only while leaving sensor ingestion unchanged', async () => {
    const batchResponse = await request('/api/batches', {
      token: 'admin-token',
      method: 'POST',
      body: JSON.stringify({
        produce_type: 'Avocado',
        quantity: 10,
        source_location: 'Nairobi'
      })
    });
    assert.equal(batchResponse.status, 201);
    assert.equal(databaseWrites.length, 1);
    assert.match(databaseWrites[0].path, /^PRODUCE_BATCH\/BATCH-/);

    const sensorResponse = await request('/api/sensor-data', {
      method: 'POST',
      body: JSON.stringify({
        device_id: 'sensor-1',
        batch_id: 'BATCH-1',
        temperature: 4,
        humidity: 90
      })
    });
    assert.equal(sensorResponse.status, 201);
    assert.equal(databaseWrites.length, 2);
  });

  it('rejects invalid user roles and weak initial passwords', async () => {
    const response = await request('/api/admin/users', {
      token: 'admin-token',
      method: 'POST',
      body: JSON.stringify({
        email: 'new-user@example.test',
        display_name: 'New User',
        password: 'short',
        role: 'owner'
      })
    });
    assert.equal(response.status, 400);
    assert.equal([...auth.users.keys()].some((uid) => uid.startsWith('created-')), false);
  });
});
