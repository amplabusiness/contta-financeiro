
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

// --- OFX Parser Logic (Embedded) ---

function formatOFXDate(ofxDate) {
    if (!ofxDate) return new Date().toISOString().split('T')[0];
    const year = ofxDate.substring(0, 4);
    const month = ofxDate.substring(4, 6);
    const day = ofxDate.substring(6, 8);
    return `${year}-${month}-${day}`;
}

function extractTag(content, tag) {
    const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'); // Relaxed regex to handle newlines better if simple
    const match = content.match(regex);
    return match ? match[1].trim() : '';
}

function parseOFX(content) {
    const transactions = [];
    let bankInfo = null;

    try {
        // Extract bank info
        const bankIdMatch = content.match(/<BANKID>([^<\r\n]+)/i);
        const acctIdMatch = content.match(/<ACCTID>([^<\r\n]+)/i);
        
        if (bankIdMatch && acctIdMatch) {
            bankInfo = {
                bankId: bankIdMatch[1].trim(),
                accountId: acctIdMatch[1].trim()
            };
        }

        // Extract all STMTTRN (statement transaction) blocks
        const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
        let match;

        while ((match = stmtTrnRegex.exec(content)) !== null) {
            const trn = match[1];

            const type = extractTag(trn, 'TRNTYPE');
            const date = extractTag(trn, 'DTPOSTED');
            let amount = parseFloat(extractTag(trn, 'TRNAMT').replace(',', '.')); // Ensure dot decimal
            const fitid = extractTag(trn, 'FITID');
            const name = extractTag(trn, 'NAME');
            const memo = extractTag(trn, 'MEMO');
            const checknum = extractTag(trn, 'CHECKNUM');

            const description = memo || name || checknum || 'Transação sem descrição';
            const reference = fitid || `OFX-${Date.now()}-${Math.random()}`;
            
            transactions.push({
                bank_reference: reference, // stored in fitid usually
                fitid: reference,
                transaction_date: formatOFXDate(date),
                amount: amount, // Keep sign!
                description: description.trim(),
                transaction_type: amount > 0 ? 'credit' : 'debit',
                import_type: 'OFX'
            });
        }

        return { transactions, bankInfo };
    } catch (error) {
        console.error('Error parsing OFX:', error);
        throw error;
    }
}

// --- Processor Logic ---

async function processQueue() {
    console.log('--- Checking ELT Queue (import_files) ---');

    // 1. Fetch Pending Files
    const { data: tasks, error } = await supabase
        .from('import_files')
        .select('*')
        .eq('status', 'pending')
        .limit(1);

    if (error) {
        console.error('Error fetching queue:', error);
        return;
    }

    if (!tasks || tasks.length === 0) {
        console.log('No pending files found. Use scripts/elt_upload_file.mjs to add one.');
        return;
    }

    const task = tasks[0];
    console.log(`Picked up Task: ${task.id}`);
    console.log(`File: ${task.original_name} (${task.file_type})`);

    // 2. Mark as Processing
    await supabase.from('import_files').update({ status: 'processing' }).eq('id', task.id);

    try {
        // 3. Download File
        console.log(`Downloading ${task.file_path}...`);
        const { data: fileData, error: downError } = await supabase
            .storage
            .from(task.bucket_id)
            .download(task.file_path);

        if (downError) throw downError;

        const textContent = await fileData.text();
        console.log(`File downloaded. Size: ${textContent.length} chars.`);

        // 4. Parse
        let parsedData = { transactions: [] };
        if (task.file_type === 'OFX' || task.original_name.toLowerCase().endsWith('.ofx')) {
            parsedData = parseOFX(textContent);
        } else {
            throw new Error(`Parser for ${task.file_type} not implemented yet.`);
        }

        const txs = parsedData.transactions;
        console.log(`Parsed ${txs.length} transactions.`);

        // 5. Simulate Insertion (Check for Duplicates)
        let newCount = 0;
        let dupCount = 0;
        
        // Retrieve existing fitids to compare
        const { data: existing } = await supabase.from('bank_transactions').select('fitid');
        const existingSet = new Set(existing.map(e => e.fitid));

        const toInsert = [];
        
        for (const tx of txs) {
            if (existingSet.has(tx.fitid)) {
                dupCount++;
            } else {
                newCount++;
                toInsert.push(tx);
            }
        }

        console.log(`Analysis: ${newCount} New, ${dupCount} Duplicates.`);
        
        if (newCount > 0) {
            console.log(`(Dry Run) Would insert ${newCount} records.`);
        }

        // 6. Success
        await supabase
            .from('import_files')
            .update({ 
                status: 'completed',
                processed_at: new Date(),
                processing_metadata: { 
                    lines_parsed: txs.length, 
                    new_records: newCount, 
                    duplicates: dupCount,
                    success: true 
                }
            })
            .eq('id', task.id);

        console.log(`✅ Task Completed Successfully.`);

    } catch (err) {
        console.error(`❌ Processing Failed:`, err);
        await supabase
            .from('import_files')
            .update({ 
                status: 'error',
                error_log: err.message
            })
            .eq('id', task.id);
    }
}

processQueue();
