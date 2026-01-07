
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
  const localEnv = fs.readFileSync('.env.local', 'utf-8');
  const lines = localEnv.split('\n');
  for (const line of lines) {
    if (line.startsWith('SUPABASE_DB_PASSWORD=')) {
      process.env.SUPABASE_DB_PASSWORD = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

const dbPassword = process.env.SUPABASE_DB_PASSWORD;

console.log("Debug:");
console.log("Project Ref:", projectRef);
console.log("Password length:", dbPassword ? dbPassword.length : 'NULL');

if (!projectRef || !dbPassword) {
  console.error("Missing Project Ref or DB Password.");
  process.exit(1);
}

// Construct connection string
// Trying standard direct connection
const connectionString = `postgres://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`;

console.log(`Connecting to database at db.${projectRef}.supabase.co...`);

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false } // Required for Supabase
});

async function deploy() {
  try {
    await client.connect();
    console.log("Connected!");

    const sqlPath = path.join(__dirname, 'create_dre_function.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log("Executing SQL...");
    await client.query(sql);

    console.log("✅ Function deployed successfully!");
  } catch (err) {
    console.error("Deployment failed:", err);
  } finally {
    await client.end();
  }
}

deploy();
