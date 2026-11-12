import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

// Read fresh each time a pool is built (not a module-level constant) so a
// runtime connection-details change (see routes/dbConfig.js) takes effect on
// the next getPool() call without restarting the process.
function buildConfig() {
  return {
    server: process.env.DB_SERVER,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 1433,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
      enableArithAbort: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

let poolPromise;

export function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(buildConfig())
      .connect()
      .then((pool) => {
        console.log('Connected to SQL Server:', process.env.DB_NAME);
        return pool;
      })
      .catch((err) => {
        poolPromise = undefined;
        console.error('Database connection failed:', err.message);
        throw err;
      });
  }
  return poolPromise;
}

// Closes the current pool (if any) and clears it so the next getPool() call
// reconnects using whatever is currently in process.env.
export async function resetPool() {
  if (poolPromise) {
    try {
      const pool = await poolPromise;
      await pool.close();
    } catch {
      // Already closed or never connected — nothing to clean up.
    }
  }
  poolPromise = undefined;
}

export { sql };
