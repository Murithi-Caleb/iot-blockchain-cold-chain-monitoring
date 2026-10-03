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
    ['operator-token', { uid: 'operator-1', email: 'operator-1@example.test', role: 'supply_chain_operator' }],
    ['traceability-token', { uid: 'trace-1', email: 'trace-1@example.test', role: 'authorized_traceability_user' }],
    ['norole-token', { uid: 'norole-1', email: 'norole-1@example.test' }]
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
let databaseStore;

beforeEach(async () => {
  auth = createFakeAuth([
    makeUser('admin-1', 'system_admin'),
    makeUser('admin-2', 'system_admin'),
    makeUser('operator-1', 'supply_chain_operator')
  ]);
  databaseWrites = [];
  // Minimal Realtime Database fake: `set` records the write and stores the value;
  // reads resolve against the stored values by exact path or direct child paths.
  databaseStore = new Map();
  const db = {
    ref(path) {
      const readSnapshot = (limit) => {
        let value = databaseStore.has(path) ? structuredClone(databaseStore.get(path)) : null;
        if (value === null) {
          const children = [...databaseStore.entries()].filter(([key]) =>
            key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'));
          if (children.length > 0) {
            value = Object.fromEntries(children.map(([key, child]) => [key.slice(path.length + 1), structuredClone(child)]));
          }
        }
        if (value && limit) {
          const keys = Object.keys(value).sort().slice(-limit);
          value = Object.fromEntries(keys.map((key) => [key, value[key]]));
        }
        return { val: () => value };
      };
      return {
        async set(value) {
          databaseWrites.push({ path, value });
          databaseStore.set(path, structuredClone(value));
        },
        async once() {
          return readSnapshot();
        },
        orderByKey() {
          return {
            limitToLast(limit) {
              return {
                async once() {
                  return readSnapshot(limit);
                }
              };
            }
          };
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

    const adminBatchRequest = await request('/api/batches', {
      token: 'admin-token',
      method: 'POST',
      body: JSON.stringify({
        produce_type: 'Avocado',
        quantity: 10,
        source_location: 'Nairobi'
      })
    });
    assert.equal(adminBatchRequest.status, 403);
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

  it('restricts batch registration to supply chain operators while leaving sensor ingestion unchanged', async () => {
    const batchBody = JSON.stringify({
      produce_type: 'Avocado',
      quantity: 10,
      source_location: 'Nairobi'
    });

    const anonymous = await request('/api/batches', { method: 'POST', body: batchBody });
    assert.equal(anonymous.status, 401);

    for (const token of ['admin-token', 'traceability-token', 'norole-token']) {
      const forbidden = await request('/api/batches', { token, method: 'POST', body: batchBody });
      assert.equal(forbidden.status, 403, `${token} must not register batches`);
    }
    assert.equal(databaseWrites.length, 0);

    const batchResponse = await request('/api/batches', {
      token: 'operator-token',
      method: 'POST',
      body: batchBody
    });
    assert.equal(batchResponse.status, 201);
    assert.equal(databaseWrites.length, 1);
    assert.match(databaseWrites[0].path, /^PRODUCE_BATCH\/BATCH-/);
    assert.equal((await batchResponse.json()).traceability_id, databaseWrites[0].value.batch_id);

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

  it('lets every provisioned role read batches but rejects anonymous and role-less users', async () => {
    databaseStore.set('PRODUCE_BATCH/BATCH-1000', {
      batch_id: 'BATCH-1000',
      produce_type: 'Avocado',
      quantity: 10,
      source_location: 'Nairobi',
      registration_date: '2026-01-01T00:00:00.000Z',
      status: 'In Transit'
    });
    databaseStore.set('PRODUCE_BATCH/BATCH-2000', {
      batch_id: 'BATCH-2000',
      produce_type: 'Mango',
      quantity: 5,
      source_location: 'Machakos',
      registration_date: '2026-02-01T00:00:00.000Z',
      status: 'In Transit'
    });

    assert.equal((await request('/api/batches')).status, 401);
    assert.equal((await request('/api/batches', { token: 'norole-token' })).status, 403);

    for (const token of ['admin-token', 'operator-token', 'traceability-token']) {
      const listResponse = await request('/api/batches', { token });
      assert.equal(listResponse.status, 200);
      const listed = await listResponse.json();
      assert.deepEqual(listed.data.map((batch) => batch.batch_id), ['BATCH-2000', 'BATCH-1000']);
    }

    const single = await request('/api/batches/BATCH-1000', { token: 'traceability-token' });
    assert.equal(single.status, 200);
    assert.equal((await single.json()).data.produce_type, 'Avocado');

    assert.equal((await request('/api/batches/BATCH-9999', { token: 'operator-token' })).status, 404);
    assert.equal((await request('/api/batches/not-a-batch', { token: 'operator-token' })).status, 400);
    assert.equal((await request('/api/batches/BATCH-1000')).status, 401);
  });

  it('returns the most recent environmental readings for a batch in chronological order', async () => {
    for (const [index, temperature] of [4.1, 4.4, 4.9].entries()) {
      const key = `READING-${1000 + index}`;
      databaseStore.set(`ENVIRONMENTAL_READING/BATCH-1000/${key}`, {
        reading_id: key,
        device_id: 'sensor-1',
        batch_id: 'BATCH-1000',
        temperature,
        humidity: 90,
        recorded_at: `2026-01-01T00:00:0${index}.000Z`
      });
    }

    const response = await request('/api/batches/BATCH-1000/readings?limit=2', { token: 'traceability-token' });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data.map((reading) => reading.temperature), [4.4, 4.9]);

    const empty = await request('/api/batches/BATCH-2000/readings', { token: 'operator-token' });
    assert.deepEqual((await empty.json()).data, []);

    assert.equal((await request('/api/batches/BATCH-1000/readings')).status, 401);
    assert.equal((await request('/api/batches/bad/readings', { token: 'operator-token' })).status, 400);
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
