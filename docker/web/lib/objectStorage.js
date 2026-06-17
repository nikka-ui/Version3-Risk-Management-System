const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} = require('@aws-sdk/client-s3');

const BUCKET = process.env.S3_BUCKET || 'rms-uploads';

let client = null;

function getClient() {
  if (client) return client;
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || 'us-east-1';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3/MinIO credentials not configured (S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY).');
  }
  client = new S3Client({
    region,
    endpoint,
    forcePathStyle: process.env.S3_USE_PATH_STYLE_ENDPOINT !== 'false',
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

async function ensureBucket() {
  const s3 = getClient();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch (err) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
      return;
    }
    throw err;
  }
}

async function putObject(key, body, contentType) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    }),
  );
}

async function getObjectStream(key) {
  const result = await getClient().send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  );
  return result.Body;
}

async function deleteObject(key) {
  try {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      }),
    );
  } catch {
    /* ignore missing objects */
  }
}

async function deleteObjects(keys) {
  const list = (keys || []).filter(Boolean);
  if (!list.length) return;
  await getClient().send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: {
        Objects: list.map((Key) => ({ Key })),
        Quiet: true,
      },
    }),
  );
}

module.exports = {
  BUCKET,
  ensureBucket,
  putObject,
  getObjectStream,
  deleteObject,
  deleteObjects,
};
