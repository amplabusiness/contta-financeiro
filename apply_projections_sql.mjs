
import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const { Client } = pg;

async function run() {
    const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    
    if (!dbUrl) {
        console.error("❌ DATABASE_URL not found in .env");
        process.exit(1);
    }

    const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false } // Required for Supabase usually
    });

    try {
        await client.connect();
        console.log("🔌 Connected to Postgres.");

        const sql = fs.readFileSync(path.join(__dirname, 'create_projection_views.sql'), 'utf8');
        await client.query(sql);

        console.log("✅ Views created successfully.");
    } catch (err) {
        console.error("❌ Error executing SQL:", err);
    } finally {
        await client.end();
    }
}

run();
