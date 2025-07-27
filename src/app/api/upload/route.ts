// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// Validate environment variables
const requiredEnvVars = ['AWS_REGION', 'S3_ACCESS_KEY', 'S3_SECRET_ACCESS_KEY', 'BUCKET_NAME'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
];

interface UploadError {
  error: string;
  details?: string;
}

interface UploadSuccess {
  success: true;
  files: Array<{
    fileName: string;
    key: string;
    url: string;
    size: number;
    type: string;
  }>;
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File ${file.name} exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`;
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `File type ${file.type} is not allowed`;
  }
  
  return null;
}

function sanitizeFileName(fileName: string): string {
  // Remove or replace unsafe characters
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadSuccess | UploadError>> {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    // Validate request
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' }, 
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Too many files. Maximum ${MAX_FILES} files allowed` },
        { status: 400 }
      );
    }

    // Validate each file
    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        return NextResponse.json(
          { error: validationError },
          { status: 400 }
        );
      }
    }

    // Upload files
    const uploadPromises = files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileExtension = file.name.split('.').pop() || '';
      const sanitizedName = sanitizeFileName(file.name.split('.')[0]);
      const uniqueFileName = `${sanitizedName}_${uuidv4()}.${fileExtension}`;
      
      const uploadParams = {
        Bucket: process.env.BUCKET_NAME!,
        Key: `uploads/${uniqueFileName}`, // Add folder structure
        Body: buffer,
        ContentType: file.type,
        Metadata: {
          originalName: file.name,
          uploadDate: new Date().toISOString(),
        },
      };

      const command = new PutObjectCommand(uploadParams);
      await s3Client.send(command);

      return {
        fileName: file.name,
        key: `uploads/${uniqueFileName}`,
        url: `${process.env.CLOUDFRONT_URL}/uploads/${uniqueFileName}`,
        //url: `https://${process.env.BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/uploads/${uniqueFileName}`,
        size: file.size,
        type: file.type,
      };
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    return NextResponse.json({ 
      success: true, 
      files: uploadedFiles 
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Don't expose internal errors to client
    return NextResponse.json(
      { 
        error: 'Upload failed',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

// Add other HTTP methods with proper error handling
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}