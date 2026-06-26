import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const base = process.env.LOCAL_ONE_API_URL || 'http://127.0.0.1:47110';

async function json(response) {
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
  return response.json();
}

const status = await json(await fetch(`${base}/api/status`));
assert.equal(status.trusted, true);
assert.equal(status.device.name.length > 0, true);

const text = await json(
  await fetch(`${base}/api/transfers/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'smoke-note',
      content: 'Local ONE API smoke text',
      secretMode: false,
    }),
  })
);
assert.equal(text.transfer.status, 'complete');

const secret = await json(
  await fetch(`${base}/api/transfers/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '.env.local',
      content: 'OPENAI_API_KEY=local-one-smoke',
      secretMode: true,
    }),
  })
);
assert.equal(secret.transfer.secretMode, true);
assert.equal(secret.transfer.items[0].preview.includes('local-one-smoke'), false);

const payload = Buffer.from('Local ONE chunk smoke file\n');
const init = await json(
  await fetch(`${base}/api/transfers/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secretMode: false,
      items: [
        {
          name: 'smoke.txt',
          mimeType: 'text/plain',
          relativePath: 'smoke.txt',
          size: payload.length,
          chunkSize: 8,
        },
      ],
    }),
  })
);

const item = init.transfer.items[0];
for (let index = 0; index < item.totalChunks; index += 1) {
  const start = index * item.chunkSize;
  const chunk = payload.subarray(start, start + item.chunkSize);
  await json(
    await fetch(`${base}/api/transfers/${init.transfer.id}/items/${item.id}/chunks/${index}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Chunk-Start': String(start),
      },
      body: chunk,
    })
  );
}

const finished = await json(
  await fetch(`${base}/api/transfers/${init.transfer.id}/items/${item.id}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
);
assert.equal(finished.transfer.status, 'complete');
assert.equal(
  finished.transfer.items[0].checksum,
  crypto.createHash('sha256').update(payload).digest('hex')
);

const download = await fetch(
  `${base}/api/transfers/${init.transfer.id}/items/${item.id}/download`
);
assert.equal(await download.text(), payload.toString());

for (const transferId of [text.transfer.id, secret.transfer.id, init.transfer.id]) {
  await json(
    await fetch(`${base}/api/transfers/${transferId}`, {
      method: 'DELETE',
    })
  );
}

console.log('Local ONE APIスモーク成功');
