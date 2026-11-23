import { accountEmail, accountName, accountPassword } from '../apps/api/src/auth/routes.ts';
import { User } from '../apps/api/src/auth/models.ts';
import { hashPassword } from '../apps/api/src/auth/passwords.ts';
import { readConfig } from '../apps/api/src/config.ts';
import { connectDatabase, disconnectDatabase } from '../apps/api/src/database.ts';
import { isDuplicateKey } from '../apps/api/src/http.ts';

const { mongoUri } = readConfig();
const name = accountName.safeParse(process.env.ADMIN_NAME);
const email = accountEmail.safeParse(process.env.ADMIN_EMAIL);
const password = accountPassword.safeParse(process.env.ADMIN_PASSWORD);
if (!mongoUri || !name.success || !email.success || !password.success) {
  throw new Error('Set MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, and an ADMIN_PASSWORD of 12 to 128 characters.');
}

try {
  await connectDatabase(mongoUri);
  await User.create({ name: name.data, email: email.data, passwordHash: await hashPassword(password.data), role: 'admin' });
  console.log('Administrator created.');
} catch (error) {
  console.error(isDuplicateKey(error) ? 'An account already uses that email. No account was updated.' : 'Administrator setup failed.');
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
