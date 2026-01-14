import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createStorageAdapter } from '@/lib/storage';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const storage = createStorageAdapter();
    const timestamp = Date.now();
    const fileName = `${params.id}/${timestamp}-${file.name}`;
    
    const storagePath = await storage.upload(buffer, fileName, {
      originalName: file.name,
      size: file.size,
      type: file.type,
    });

    const storeFile = await prisma.storeFile.create({
      data: {
        storeId: params.id,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        storagePath,
        uploadedBy: user.email,
        description,
      },
    });

    return NextResponse.json(storeFile, { status: 201 });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
