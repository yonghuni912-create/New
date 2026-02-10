import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const dynamic = 'force-dynamic';

// GET - Get all files for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const files = await prisma.taskFile.findMany({
      where: { taskId: id },
      include: {
        uploadedBy: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(files);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}

// POST - Upload a file to a task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as { id: string };

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, storeId: true }
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = file.name.split('.').pop() || '';
    const fileName = `${task.storeId}_${id}_${timestamp}.${ext}`;

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'tasks');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Save file
    const filePath = join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Create database record
    const taskFile = await prisma.taskFile.create({
      data: {
        taskId: id,
        fileName,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        path: `/uploads/tasks/${fileName}`,
        uploadedById: user.id
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json(taskFile);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

// DELETE - Delete a file
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const user = session.user as { id: string; role: string };
    const file = await prisma.taskFile.findUnique({
      where: { id: fileId }
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Only uploader or admin can delete
    if (file.uploadedById !== user.id && user.role !== 'ADMIN' && user.role !== 'MASTER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete physical file
    try {
      const filePath = join(process.cwd(), 'public', file.path);
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (e) {
      console.error('Failed to delete physical file:', e);
    }

    // Delete database record
    await prisma.taskFile.delete({
      where: { id: fileId }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
