import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config.ts';
import { HttpError, parseInput } from '../http.ts';
import { User } from './models.ts';
import { accountName, publicUser, sessionAccess } from './routes.ts';

const addressInput = z.strictObject({
  label: z.string().trim().min(1).max(60),
  address: z.string().trim().min(8).max(350),
});
const addressId = z.string().regex(/^[a-f0-9]{24}$/i);
const nameInput = z.strictObject({ name: accountName });

export function profileRouter(config: AppConfig) {
  const router = Router();
  const sessions = sessionAccess(config);
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/', async (request, response) => {
    const user = await sessions.requireUser(request);
    response.json({ user: publicUser(user), addresses: user.addresses ?? [] });
  });
  router.patch('/', async (request, response) => {
    const user = await sessions.requireUser(request);
    const { name } = parseInput(nameInput, request.body);
    const updated = await User.findByIdAndUpdate(user._id, { $set: { name } }, { returnDocument: 'after' });
    if (!updated) throw new HttpError(404, 'ACCOUNT_NOT_FOUND', 'The account was not found.');
    response.json({ user: publicUser(updated) });
  });
  router.post('/addresses', async (request, response) => {
    const user = await sessions.requireUser(request);
    const address = parseInput(addressInput, request.body);
    const result = await User.findOneAndUpdate({ _id: user._id, 'addresses.9': { $exists: false } }, { $push: { addresses: address } }, { returnDocument: 'after', runValidators: true });
    if (!result) throw new HttpError(409, 'ADDRESS_LIMIT', 'You can save up to ten addresses.');
    response.status(201).json({ addresses: result.addresses });
  });
  router.patch('/addresses/:id', async (request, response) => {
    const user = await sessions.requireUser(request);
    const id = parseInput(addressId, request.params.id);
    const address = parseInput(addressInput, request.body);
    const updated = await User.findOneAndUpdate({ _id: user._id, 'addresses._id': id }, {
      $set: { 'addresses.$.label': address.label, 'addresses.$.address': address.address },
    }, { returnDocument: 'after', runValidators: true });
    if (!updated) throw new HttpError(404, 'ADDRESS_NOT_FOUND', 'The address was not found.');
    response.json({ addresses: updated.addresses });
  });
  router.delete('/addresses/:id', async (request, response) => {
    const user = await sessions.requireUser(request);
    const id = parseInput(addressId, request.params.id);
    await User.updateOne({ _id: user._id }, { $pull: { addresses: { _id: id } } });
    response.status(204).end();
  });
  return router;
}
