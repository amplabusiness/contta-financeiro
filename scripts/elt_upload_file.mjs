
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function uploadFileToStorage(filePath, bucketName = 'financial-statements') {
    console.log(`--- Starting ELT Upload for: ${path.basename(filePath)} ---`);

    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return;
    }

    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const storagePath = `${new Date().getFullYear()}/${new Date().getMonth() + 1}/${Date.now()}_${fileName}`;

    // 1. Upload to Bucket
    console.log(`1. Uploading to Storage...`);
    
    let mimeType = 'application/octet-stream';
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.csv') mimeType = 'text/csv';
    if (ext === '.ofx') mimeType = 'application/x-ofx';

    const { data: storageData, error: storageError } = await supabase
        .storage
        .from(bucketName)
        .upload(storagePath, fileContent, {
            contentType: mimeType,
            upsert: false
        });

    if (storageError) {
        console.error(`❌ Upload Failed:`, storageError.message);
        return;
    }
    console.log(`✅ Upload success: ${storageData.path}`);

    // 2. Register in Tracking Table
    console.log(`2. Registering in import_files table...`);
    const { data: dbData, error: dbError } = await supabase
        .from('import_files')
        .insert({
            bucket_id: bucketName,
            file_path: storageData.path,
            original_name: fileName,
            file_type: path.extname(filePath).replace('.', '').toUpperCase(),
            status: 'pending',
            uploaded_by: (await supabase.auth.getUser()).data.user?.id // Might be null if service role, handled by DB default or relaxed RLS
        })
        .select()
        .single();

    if (dbError) {
        console.error(`❌ DB Insert Failed:`, dbError.message);
        // Optional: Delete file if DB insert fails to keep consistent
        return;
    }

    console.log(`✅ Registered for processing! Import ID: ${dbData.id}`);
    console.log(`--- Ready for Processor ---`);
}

// Check if run directly
if (process.argv[2]) {
    uploadFileToStorage(process.argv[2]);
} else {
    console.log("Usage: node scripts/elt_upload_file.mjs <path_to_file>");
    console.log("Example: node scripts/elt_upload_file.mjs ./extrato_jan.csv");
}
