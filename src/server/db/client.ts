import "server-only";
import { MongoClient, type Db } from "mongodb";
import { getEnv } from "../env";

/*
  One MongoClient per server instance, cached on globalThis so dev hot reloads and
  warm serverless invocations reuse the pool (BACKEND_PLAN.md §4 serverless notes).
*/

type MongoCache = { client?: MongoClient; connecting?: Promise<MongoClient> };
const g = globalThis as typeof globalThis & { __kkMongo?: MongoCache };
const cache: MongoCache = (g.__kkMongo ??= {});

export function getMongoClient(): Promise<MongoClient> {
  if (cache.client) return Promise.resolve(cache.client);
  if (!cache.connecting) {
    const env = getEnv();
    const client = new MongoClient(env.MONGODB_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5_000,
      appName: "kaththokra",
    });
    cache.connecting = client
      .connect()
      .then((c) => {
        cache.client = c;
        return c;
      })
      .catch((err) => {
        cache.connecting = undefined;
        throw err;
      });
  }
  return cache.connecting;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(getEnv().MONGODB_DB);
}

export async function pingDb(): Promise<void> {
  const db = await getDb();
  await db.command({ ping: 1 });
}

/** For scripts: close the pool so the process can exit. */
export async function closeDb(): Promise<void> {
  const client = cache.client;
  cache.client = undefined;
  cache.connecting = undefined;
  if (client) await client.close();
}
