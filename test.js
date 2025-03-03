const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const testS3Connection = async () => {
  try {
    const data = await s3.send(new ListBucketsCommand({}));
    console.log("S3 Buckets:", data.Buckets);
  } catch (error) {
    console.error("S3 Connection Error:", error);
  }
};

testS3Connection();