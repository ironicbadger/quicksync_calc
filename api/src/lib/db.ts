import { createClient, Client } from '@libsql/client';

export interface Env {
  TURSO_URL: string;
  TURSO_AUTH_TOKEN: string;
  ENVIRONMENT: string;
  PENDING_SUBMISSIONS: KVNamespace;
  TURNSTILE_SECRET: string;
  ADMIN_PASSPHRASE: string;
}

let client: Client | null = null;

export function getDb(env: Env): Client {
  if (!client) {
    client = createClient({
      url: env.TURSO_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export interface BenchmarkResult {
  id: number;
  submitted_at: string;
  submitter_id: string | null;
  cpu_raw: string;
  cpu_brand: string | null;
  cpu_model: string | null;
  cpu_generation: number | null;
  architecture: string | null;
  test_name: string;
  test_file: string;
  bitrate_kbps: number;
  time_seconds: number;
  avg_fps: number;
  avg_speed: number | null;
  avg_watts: number | null;
  fps_per_watt: number | null;
  result_hash: string;
  vendor: string;
}

export interface ConcurrencyResult {
  id: number;
  submitted_at: string;
  submitter_id: string | null;
  cpu_raw: string;
  cpu_brand: string | null;
  cpu_model: string | null;
  cpu_generation: number | null;
  architecture: string | null;
  test_name: string;
  test_file: string;
  speeds_json: string;
  max_concurrency: number;
  result_hash: string;
  vendor: string;
}
