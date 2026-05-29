// R2 end-to-end test script — verify upload + public read works.
// Run: node scripts/test-r2.mjs
//
// Reads env from .env.local (same as Next.js dev).

// Run with: node --env-file=.env.local scripts/test-r2.mjs
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicUrl = process.env.R2_PUBLIC_URL;

console.log('=== R2 Test ===');
console.log('Account ID :', accountId?.slice(0, 8) + '…');
console.log('Bucket     :', bucket);
console.log('Public URL :', publicUrl);
console.log('');

if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
  console.error('❌ Missing env vars');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

const testKey = `videos/test-${Date.now()}.txt`;
const testContent = `R2 connectivity test at ${new Date().toISOString()}\n`;

// Step 1: direct PUT via SDK
console.log('1. PUT via SDK to key:', testKey);
const putStart = Date.now();
try {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: testKey,
    Body: testContent,
    ContentType: 'text/plain',
  }));
  console.log(`   ✓ PUT success (${Date.now() - putStart} ms)`);
} catch (err) {
  console.error('   ❌ PUT failed:', err.message);
  console.error('   Full error:', err);
  process.exit(1);
}

// Step 2: HEAD to confirm object exists
console.log('2. HEAD to confirm exists');
try {
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: testKey }));
  console.log(`   ✓ HEAD success — size: ${head.ContentLength} bytes, type: ${head.ContentType}`);
} catch (err) {
  console.error('   ❌ HEAD failed:', err.message);
  process.exit(1);
}

// Step 3: public URL fetch
const fetchUrl = `${publicUrl}/${testKey}`;
console.log('3. GET via public URL:', fetchUrl);
try {
  const resp = await fetch(fetchUrl);
  console.log(`   Status: ${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const body = await resp.text();
    console.log(`   ✓ Body matches: ${body.trim() === testContent.trim()}`);
    console.log(`   Cache-Control: ${resp.headers.get('cache-control') || '(none)'}`);
  } else {
    console.error('   ❌ Public fetch failed');
  }
} catch (err) {
  console.error('   ❌ Fetch error:', err.message);
}

// Step 4: presigned URL flow (mimics our /api/r2/sign-upload)
console.log('4. Presigned PUT flow (mimics production /api/r2/sign-upload)');
const presignedKey = `videos/presigned-${Date.now()}.txt`;
const presignedBody = 'presigned test\n';
try {
  const signedUrl = await getSignedUrl(client, new PutObjectCommand({
    Bucket: bucket,
    Key: presignedKey,
    ContentType: 'text/plain',
  }), { expiresIn: 300 });
  console.log('   ✓ Presigned URL generated');

  // PUT via fetch (mimics browser)
  const putResp = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: presignedBody,
  });
  console.log(`   Browser-style PUT status: ${putResp.status} ${putResp.statusText}`);
  if (!putResp.ok) {
    const errBody = await putResp.text();
    console.error('   ❌ Presigned PUT failed body:', errBody.slice(0, 500));
  } else {
    console.log('   ✓ Presigned PUT success — browser flow works!');
    // verify public read
    const verifyResp = await fetch(`${publicUrl}/${presignedKey}`);
    console.log(`   Public read status: ${verifyResp.status}`);
  }
} catch (err) {
  console.error('   ❌ Presigned flow error:', err.message);
}

// Step 5: cleanup test objects
console.log('5. Cleanup test objects');
try {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: presignedKey }));
  console.log('   ✓ Cleaned up');
} catch (err) {
  console.warn('   ⚠ Cleanup failed (ok, manual cleanup later):', err.message);
}

console.log('\n=== Done ===');
