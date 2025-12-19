import { db } from '../db/index.js';
import { authenticate } from '../plugins/auth.js';
import { hashPassword, verifyPassword } from '../lib/auth.js';
import { ValidationError, NotFoundError, ConflictError, UnauthorizedError } from '../lib/errors.js';
import type { FastifyInstance } from 'fastify';

export const userRoutes = async (fastify: FastifyInstance) => {
  // Change email
  fastify.patch('/api/user/email', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { new_email, password } = request.body as { new_email?: string; password?: string };

    if (!new_email || !password) {
      throw new ValidationError('new_email and password are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(new_email)) {
      throw new ValidationError('Invalid email format');
    }

    // Get user and verify password
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Incorrect password');
    }

    // Check if new email is already in use
    const existing = await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', new_email.toLowerCase().trim())
      .where('id', '!=', userId)
      .executeTakeFirst();

    if (existing) {
      throw new ConflictError('Email already in use');
    }

    // Update email
    const updated = await db
      .updateTable('users')
      .set({
        email: new_email.toLowerCase().trim(),
        updated_at: new Date(),
      })
      .where('id', '=', userId)
      .returning(['id', 'email', 'created_at'])
      .executeTakeFirstOrThrow();

    return reply.send({
      success: true,
      user: updated,
    });
  });

  // Change password
  fastify.patch('/api/user/password', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { current_password, new_password } = request.body as {
      current_password?: string;
      new_password?: string;
    };

    if (!current_password || !new_password) {
      throw new ValidationError('current_password and new_password are required');
    }

    if (new_password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }

    // Get user and verify current password
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isValid = await verifyPassword(current_password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Incorrect current password');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(new_password);

    // Update password
    await db
      .updateTable('users')
      .set({
        password_hash: newPasswordHash,
        updated_at: new Date(),
      })
      .where('id', '=', userId)
      .execute();

    return reply.send({
      success: true,
    });
  });

  // Delete account
  fastify.delete('/api/user/account', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { email, confirm } = request.body as { email?: string; confirm?: boolean };

    if (!email || confirm !== true) {
      throw new ValidationError('Email and confirmation required');
    }

    // Get user to verify email matches
    const user = await db
      .selectFrom('users')
      .select(['id', 'email'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify email matches
    if (user.email.toLowerCase() !== email.toLowerCase().trim()) {
      throw new ValidationError('Email does not match');
    }

    // Delete user (cascading delete will handle all related data)
    await db.deleteFrom('users').where('id', '=', userId).execute();

    return reply.send({
      success: true,
      message: 'Account deleted successfully',
    });
  });
};

