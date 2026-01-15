import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auditLog';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const manual = await prisma.menuManual.findUnique({
      where: { id },
      include: {
        ingredients: { orderBy: [{ sortOrder: 'asc' }], include: { ingredientMaster: true } }
      }
    });
    if (!manual) return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    return NextResponse.json(manual);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json();
    console.log('📝 PUT /api/manuals/[id] - Received body:', JSON.stringify(body, null, 2));
    
    // Get the current manual for audit log
    const currentManual = await prisma.menuManual.findUnique({ 
      where: { id },
      include: { ingredients: true }
    });
    
    if (!currentManual) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }
    
    // Build update data with ALL fields
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.koreanName !== undefined) updateData.koreanName = body.koreanName;
    if (body.yield !== undefined) updateData.yield = body.yield;
    if (body.yieldUnit !== undefined) updateData.yieldUnit = body.yieldUnit;
    if (body.sellingPrice !== undefined) updateData.sellingPrice = body.sellingPrice ? parseFloat(body.sellingPrice) : null;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.shelfLife !== undefined) updateData.shelfLife = body.shelfLife;
    if (body.cookingMethod !== undefined) updateData.cookingMethod = body.cookingMethod ? JSON.stringify(body.cookingMethod) : null;
    if (body.priceTemplateId !== undefined) updateData.priceTemplateId = body.priceTemplateId || null;
    
    console.log('📝 Update data:', JSON.stringify(updateData, null, 2));
    
    // Update manual basic info
    await prisma.menuManual.update({ where: { id }, data: updateData });
    
    // Handle ingredients update
    if (body.ingredients !== undefined) {
      console.log('📝 Updating ingredients:', body.ingredients?.length || 0, 'items');
      
      // Delete existing ingredients
      await prisma.manualIngredient.deleteMany({ where: { manualId: id } });
      
      // Create new ingredients
      if (body.ingredients && body.ingredients.length > 0) {
        const ingredientData = body.ingredients.map((ing: any, index: number) => ({
          manualId: id,
          ingredientId: ing.ingredientId || null,
          name: ing.name || ing.koreanName || 'Unknown',
          quantity: parseFloat(ing.quantity) || 0,
          unit: ing.unit || 'g',
          sortOrder: index,
          notes: ing.notes || null
        }));
        
        await prisma.manualIngredient.createMany({ data: ingredientData });
      }
    }
    
    // Fetch updated manual with ingredients
    const manual = await prisma.menuManual.findUnique({ 
      where: { id }, 
      include: { 
        ingredients: { 
          orderBy: { sortOrder: 'asc' },
          include: { ingredientMaster: true }
        } 
      } 
    });
    
    // Create audit log
    await createAuditLog({
      userId: (session.user as { id: string }).id,
      action: 'MANUAL_UPDATE',
      entityType: 'MenuManual',
      entityId: id,
      oldValue: { name: currentManual.name, koreanName: currentManual.koreanName },
      newValue: updateData
    });
    
    console.log('✅ Manual updated successfully:', manual?.id);
    return NextResponse.json(manual);
  } catch (error: any) {
    console.error('❌ Error updating manual:', error);
    return NextResponse.json({ error: 'Failed to update manual', details: error?.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const currentManual = await prisma.menuManual.findUnique({ where: { id } });
    await prisma.menuManual.update({ where: { id }, data: { isActive: false, isArchived: true } });
    
    // Create audit log
    await createAuditLog({
      userId: (session.user as { id: string }).id,
      action: 'MANUAL_DELETE',
      entityType: 'MenuManual',
      entityId: id,
      oldValue: currentManual ? { name: currentManual.name, koreanName: currentManual.koreanName } : null
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}