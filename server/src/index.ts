import { createApp } from './app';
import { config } from './config';
import { pool } from './db/pool';

const app = createApp(pool);

app.listen(config.port, () => {
  console.log(`Asahi payroll API listening on port ${config.port}`);
});
