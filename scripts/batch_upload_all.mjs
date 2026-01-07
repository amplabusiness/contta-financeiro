
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

const SOURCE_DIR = path.resolve(__dirname, '../banco');

async function uploadFileToStorage(filePath, bucketName = 'financial-statements') {
    const fileName = path.basename(filePath);
    console.log(`\n📄 Processing: ${fileName}`);

    // Check if file content is empty
    if (fs.statSync(filePath).size === 0) {
        console.warn(`⚠️ Skipped empty file: ${fileName}`);
        return;
    }

    const fileContent = fs.readFileSync(filePath);
    const uniqueTime = Date.now();
    // Path structure: Year/Month/Timestamp_Filename to avoid collisions
    const storagePath = `batch_import/${uniqueTime}_${fileName}`;

    // 1. Upload to Bucket
    let mimeType = 'application/octet-stream';
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.csv') mimeType = 'text/csv';
    if (ext === '.ofx') mimeType = 'application/x-ofx';

    try {
        const { data: storageData, error: storageError } = await supabase
            .storage
            .from(bucketName)
            .upload(storagePath, fileContent, {
                contentType: mimeType,
                upsert: false
            });

        if (storageError) {
            console.error(`❌ Upload Failed: ${storageError.message}`);
            return;
        }

        // 2. Register in Tracking Table
        const { data: dbData, error: dbError } = await supabase
            .from('import_files')
            .insert({
                bucket_id: bucketName,
                file_path: storageData.path,
                original_name: fileName,
                file_type: ext.replace('.', '').toUpperCase(),
                status: 'pending',
                // uploaded_by is nullable or RLS handles
            })
            .select()
            .single();

        if (dbError) {
            console.error(`❌ DB Registration Failed: ${dbError.message}`);
            // Clean up storage if DB fails
            await supabase.storage.from(bucketName).remove([storagePath]);
        } else {
            console.log(`✅ Queued: ${dbData.id}`);
        }
    } catch (err) {
        console.error("Unexpected error:", err);
    }
}

async function run() {
    console.log("🚀 Starting Batch Import from folder:", SOURCE_DIR);
    
    if (!fs.existsSync(SOURCE_DIR)) {
        console.error("Source dir not found!");
        return;
    }

    const files = fs.readdirSync(SOURCE_DIR).filter(f => f.toLowerCase().endsWith('.ofx'));
    console.log(`Found ${files.length} OFX files.`);

    for (const file of files) {
        if (file.toLowerCase().includes('jan 2025.ofx')) {
            console.log(`Skipping likely duplicate: ${file}`);
            continue;
        }
        await uploadFileToStorage(path.join(SOURCE_DIR, file));
        // Small delay to prevent rate limits or timestamp collision
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log("🏁 Batch Upload Complete.");
}

run();
