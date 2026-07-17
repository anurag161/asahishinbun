import { Pool, types } from 'pg';
import { config } from '../config';

// Return DATE columns as plain "YYYY-MM-DD" strings, not JS Date objects.
// JS Date conversion shifts midnight dates by the local UTC offset, turning
// "2026-06-01" into "2026-05-31T15:00:00Z" in JST. We always want the string.
types.setTypeParser(types.builtins.DATE, (val) => val);

const isTest = config.nodeEnv === 'test';
const connectionString = isTest ? config.databaseTestUrl : config.databaseUrl;

export const pool = new Pool({ connectionString });
