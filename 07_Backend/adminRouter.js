const express = require('express');

const USER_ROLES = Object.freeze([
  'system_admin',
  'supply_chain_operator',
  'authorized_traceability_user'
]);
const SYSTEM_ADMIN_ROLE = 'system_admin';
const AUTH_TOKEN_ERROR_CODES = new Set([
  'auth/argument-error',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/invalid-argument',
  'auth/invalid-id-token',
  'auth/user-disabled'
]);

function createAuthMiddleware(auth) {
  return async (req, res, next) => {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      console.warn('Rejected API request without a bearer token:', req.method, req.path);
      return res.status(401).json({ error: 'Authentication required.' });
    }

    try {
      req.authUser = await auth.verifyIdToken(match[1], true);
      return next();
    } catch (error) {
      if (AUTH_TOKEN_ERROR_CODES.has(error.code)) {
        console.warn('Rejected API request with an invalid Firebase ID token:', error.code);
        return res.status(401).json({ error: 'Invalid or expired authentication token.' });
      }

      return next(error);
    }
  };
}

function requireSystemAdmin(req, res, next) {
  if (req.authUser?.role !== SYSTEM_ADMIN_ROLE) {
    return res.status(403).json({ error: 'System administrator access required.' });
  }
  return next();
}

function hasOwn(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function logAdminAction(action, actorUid, targetUid, details = {}) {
  console.info('System administrator action:', {
    action,
    actor_uid: actorUid,
    target_uid: targetUid,
    ...details
  });
}

function userResponse(user, role = user.customClaims?.role) {
  return {
    uid: user.uid,
    email: user.email || null,
    display_name: user.displayName || null,
    role: USER_ROLES.includes(role) ? role : null,
    disabled: Boolean(user.disabled),
    created_at: user.metadata?.creationTime || null,
    last_sign_in_at: user.metadata?.lastSignInTime || null
  };
}

async function hasAnotherActiveAdmin(auth, excludedUid) {
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    const found = page.users.some((user) =>
      user.uid !== excludedUid
      && !user.disabled
      && user.customClaims?.role === SYSTEM_ADMIN_ROLE
    );
    if (found) {
      return true;
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return false;
}

function validateRole(role) {
  return typeof role === 'string' && USER_ROLES.includes(role);
}

function createAdminRouter(auth) {
  const router = express.Router();
  router.use(createAuthMiddleware(auth), requireSystemAdmin);

  router.get('/users', async (req, res, next) => {
    try {
      const pageToken = req.query.page_token;
      if (pageToken !== undefined && typeof pageToken !== 'string') {
        return res.status(400).json({ error: 'page_token must be a string.' });
      }

      const page = await auth.listUsers(1000, pageToken);
      return res.json({
        data: page.users.map((user) => userResponse(user)),
        next_page_token: page.pageToken || null
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/users', async (req, res, next) => {
    const body = req.body;
    if (!isObject(body)
      || Object.keys(body).some((field) =>
        !['email', 'display_name', 'password', 'role'].includes(field))
      || typeof body.email !== 'string'
      || !body.email.trim()
      || body.email.trim().length > 320
      || typeof body.display_name !== 'string'
      || !body.display_name.trim()
      || body.display_name.trim().length > 128
      || typeof body.password !== 'string'
      || body.password.length < 12
      || body.password.length > 128
      || !validateRole(body.role)) {
      return res.status(400).json({
        error: 'Provide a valid email, display_name, role, and a password of 12 to 128 characters.'
      });
    }

    let createdUser;
    try {
      createdUser = await auth.createUser({
        email: body.email.trim(),
        displayName: body.display_name.trim(),
        password: body.password
      });
      await auth.setCustomUserClaims(createdUser.uid, {
        ...createdUser.customClaims,
        role: body.role
      });

      logAdminAction('create_user', req.authUser.uid, createdUser.uid, { role: body.role });
      return res.status(201).json({
        data: userResponse({
          ...createdUser,
          customClaims: { ...createdUser.customClaims, role: body.role }
        })
      });
    } catch (error) {
      if (createdUser) {
        try {
          await auth.deleteUser(createdUser.uid);
        } catch (cleanupError) {
          console.error(
            'Failed to remove partially provisioned Firebase user:',
            cleanupError.code || cleanupError.name || 'unknown error'
          );
        }
      }
      return next(error);
    }
  });

  router.patch('/users/:uid', async (req, res, next) => {
    const body = req.body;
    const allowedFields = ['email', 'display_name', 'role', 'disabled'];
    if (!isObject(body)
      || Object.keys(body).length === 0
      || Object.keys(body).some((field) => !allowedFields.includes(field))
      || (hasOwn(body, 'email')
        && (typeof body.email !== 'string' || !body.email.trim() || body.email.trim().length > 320))
      || (hasOwn(body, 'display_name')
        && (typeof body.display_name !== 'string'
          || !body.display_name.trim()
          || body.display_name.trim().length > 128))
      || (hasOwn(body, 'role') && !validateRole(body.role))
      || (hasOwn(body, 'disabled') && typeof body.disabled !== 'boolean')) {
      return res.status(400).json({ error: 'Provide valid user fields to update.' });
    }

    try {
      const currentUser = await auth.getUser(req.params.uid);
      const nextRole = hasOwn(body, 'role') ? body.role : currentUser.customClaims?.role;
      const nextDisabled = hasOwn(body, 'disabled') ? body.disabled : currentUser.disabled;
      const removesAdminAccess = currentUser.customClaims?.role === SYSTEM_ADMIN_ROLE
        && (nextRole !== SYSTEM_ADMIN_ROLE || nextDisabled);

      if (req.authUser.uid === currentUser.uid && removesAdminAccess) {
        return res.status(409).json({ error: 'You cannot remove your own administrator access.' });
      }
      if (removesAdminAccess && !await hasAnotherActiveAdmin(auth, currentUser.uid)) {
        return res.status(409).json({ error: 'The last active administrator cannot be disabled or demoted.' });
      }

      const roleChanged = hasOwn(body, 'role') && body.role !== currentUser.customClaims?.role;
      const updatedFields = {};
      if (hasOwn(body, 'email')) {
        updatedFields.email = body.email.trim();
        if (updatedFields.email !== currentUser.email) {
          updatedFields.emailVerified = false;
        }
      }
      if (hasOwn(body, 'display_name')) {
        updatedFields.displayName = body.display_name.trim();
      }
      if (hasOwn(body, 'disabled')) {
        updatedFields.disabled = body.disabled;
      }

      if (roleChanged) {
        await auth.setCustomUserClaims(currentUser.uid, {
          ...currentUser.customClaims,
          role: body.role
        });
        try {
          await auth.revokeRefreshTokens(currentUser.uid);
        } catch (error) {
          try {
            await auth.setCustomUserClaims(currentUser.uid, currentUser.customClaims || {});
          } catch (rollbackError) {
            console.error(
              'Failed to roll back Firebase user role after token revocation failed:',
              rollbackError.code || rollbackError.name || 'unknown error'
            );
          }
          throw error;
        }
      }

      try {
        if (Object.keys(updatedFields).length > 0) {
          await auth.updateUser(currentUser.uid, updatedFields);
        }
      } catch (error) {
        if (roleChanged) {
          try {
            await auth.setCustomUserClaims(currentUser.uid, currentUser.customClaims || {});
          } catch (rollbackError) {
            console.error(
              'Failed to roll back Firebase user role after an update failure:',
              rollbackError.code || rollbackError.name || 'unknown error'
            );
          }
        }
        throw error;
      }

      const updatedUser = {
        ...currentUser,
        ...updatedFields,
        customClaims: {
          ...currentUser.customClaims,
          ...(roleChanged ? { role: body.role } : {})
        }
      };
      logAdminAction('update_user', req.authUser.uid, currentUser.uid, {
        changed_fields: Object.keys(body)
      });
      return res.json({ data: userResponse(updatedUser) });
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/users/:uid', async (req, res, next) => {
    try {
      const user = await auth.getUser(req.params.uid);
      if (req.authUser.uid === user.uid) {
        return res.status(409).json({ error: 'You cannot delete your own account.' });
      }
      if (user.customClaims?.role === SYSTEM_ADMIN_ROLE
        && !user.disabled
        && !await hasAnotherActiveAdmin(auth, user.uid)) {
        return res.status(409).json({ error: 'The last active administrator cannot be deleted.' });
      }

      await auth.deleteUser(user.uid);
      logAdminAction('delete_user', req.authUser.uid, user.uid);
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  SYSTEM_ADMIN_ROLE,
  USER_ROLES,
  createAdminRouter,
  createAuthMiddleware,
  requireSystemAdmin,
  userResponse
};
