import { Kysely } from 'kysely';
import { Resource } from 'sst';
import { LibsqlDialect } from '@libsql/kysely-libsql';
import { type CoffeeTable } from '@rpcTypes/coffee';
import { type ImageTable } from '@rpcTypes/image';

let db: Promise<Kysely<Database>> | null = null;
export function getDB(): Promise<Kysely<Database>> {
  if (!db) {
    db = (async () => {
      const url = await Resource.PetaKopiKV.get('TURSO_DB_URL');
      const authToken = await Resource.PetaKopiKV.get('TURSO_DB_SECRET');

      if (!url || !authToken) {
        throw new Error('Missing TURSO_DB_URL or TURSO_DB_SECRET');
      }

      return new Kysely<Database>({
        dialect: new LibsqlDialect({
          url: url,
          authToken: authToken,
        }),
      });
    })();
  }

  return db;
}

export interface Database {
  coffees: CoffeeTable;
  images: ImageTable;
}
