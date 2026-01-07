
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const envConfig = dotenv.parse(fs.readFileSync(path.join(__dirname, '.env')));
let localEnvConfig = {};
if (fs.existsSync(path.join(__dirname, '.env.local'))) {
    localEnvConfig = dotenv.parse(fs.readFileSync(path.join(__dirname, '.env.local')));
}

const finalEnv = { ...envConfig, ...localEnvConfig, ...process.env }; // Local overrides .env, process.env overrides all

console.log("Debug Env Manual Parse:");
console.log("VITE_SUPABASE_PROJECT_ID:", finalEnv.VITE_SUPABASE_PROJECT_ID);
console.log("SUPABASE_DB_PASSWORD exists:", !!finalEnv.SUPABASE_DB_PASSWORD);

// Try to get connection string from various standard env vars
let connectionString = finalEnv.DATABASE_URL || finalEnv.POSTGRES_URL || finalEnv.SUPABASE_DB_URL;

if (!connectionString) {
    if (finalEnv.VITE_SUPABASE_PROJECT_ID && finalEnv.SUPABASE_DB_PASSWORD) {
        // Construct standard Supabase connection string
        const projectId = finalEnv.VITE_SUPABASE_PROJECT_ID;
        const password = finalEnv.SUPABASE_DB_PASSWORD;
        // Try direct connection (5432)
        connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.${projectId}.supabase.co:5432/postgres`;
        console.log(`ℹ️ Constructed connection string for project: ${projectId}`);
    } else {
        console.error("❌ No connection string found and could not construct one (missing VITE_SUPABASE_PROJECT_ID or SUPABASE_DB_PASSWORD).");
        process.exit(1);
    }
}

async function executeSql() {
    const filename = process.argv[2];
    if (!filename) {
        console.error("Usage: node execute_sql.mjs <filename.sql>");
        process.exit(1);
    }

    const filePath = path.join(__dirname, filename);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    console.log(`📜 Reading SQL from ${filename}...`);
    const sqlContent = fs.readFileSync(filePath, 'utf8');

    const client = new pg.Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false } // Required for Supabase usually
    });

    try {
        await client.connect();
        console.log("🔌 Connected to database.");
        
        console.log(`🚀 Executing SQL...`);
        const res = await client.query(sqlContent);
        console.log("✅ Execution successful:", res.command, res.rowCount);
        
    } catch (err) {
        console.error("❌ Error executing SQL:", err);
    } finally {
        await client.end();
        console.log("🔌 Disconnected.");
    }
}

executeSql();
