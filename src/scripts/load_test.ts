import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;
const WORKER_SECRET = process.env.WORKER_SECRET || 'test_secret';

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const TEST_USER_ID = '00000000-0000-0000-0000-000000000000';

async function createMockJobs(count: number): Promise<string[]> {
  const documentIds = [];
  for (let i = 0; i < count; i++) {
    const docId = crypto.randomUUID();
    documentIds.push(docId);
    
    await supabase.from('documents').insert({
      id: docId,
      user_id: TEST_USER_ID,
      file_name: `test_doc_${i}.jpg`,
      storage_path: `test/${docId}.jpg`,
      mime_type: 'image/jpeg',
      file_size: 1024,
      processing_status: 'queued'
    });

    await supabase.from('document_processing_jobs').insert({
      document_id: docId,
      status: 'queued',
      attempt_count: 1,
      started_at: new Date().toISOString()
    });
  }
  return documentIds;
}

async function triggerWorker() {
  const url = 'http://localhost:3000/api/worker/process';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'authorization': `Bearer ${WORKER_SECRET}` }
    });
    return await res.json();
  } catch (err) {
    return { status: 'error', error: String(err) };
  }
}

async function runLoadTest(concurrency: number) {
  console.log(`\n=== RUNNING BURST TEST (${concurrency} JOBS) ===`);
  const start = Date.now();
  const docIds = await createMockJobs(concurrency);
  
  console.log('Triggering parallel workers...');
  const workerPromises = [];
  for (let i = 0; i < 5; i++) {
    workerPromises.push(triggerWorker());
  }

  const results = await Promise.all(workerPromises);
  const totalProcessed = results.reduce((acc, curr) => acc + (curr.jobsProcessed || 0), 0);
  
  const duration = Date.now() - start;
  console.log(`Processed ${totalProcessed} jobs in ${duration}ms`);
  
  const { count } = await supabase
    .from('document_processing_jobs')
    .select('*', { count: 'exact', head: true })
    .in('status', ['queued', 'retrying']);
    
  console.log(`Remaining jobs in queue: ${count}`);

  await supabase.from('document_processing_jobs').delete().in('document_id', docIds);
  await supabase.from('documents').delete().in('id', docIds);
}

runLoadTest(20).catch(console.error);
