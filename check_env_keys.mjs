
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env1 = dotenv.parse(fs.readFileSync(path.join(__dirname, '.env')));
let env2 = {};
if (fs.existsSync(path.join(__dirname, '.env.local'))) {
    env2 = dotenv.parse(fs.readFileSync(path.join(__dirname, '.env.local')));
}

const keys = new Set([...Object.keys(env1), ...Object.keys(env2)]);
console.log("Keys found:", Array.from(keys));
