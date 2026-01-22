import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAuditLog } from '@/lib/auditLog';
import { hasPermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}

// GET /api/manuals/[id] - Fetch manual with ingredients
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  
  try {
    const db = getDb();
    
    // Get manual
    const manualResult = await db.execute({
      sql: `SELECT * FROM MenuManual WHERE id = ?`,
      args: [id],
    });
    
    if (manualResult.rows.length === 0) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }
    
    const manual = manualResult.rows[0];
    
    // Get ingredients with master data
    const ingredientsResult = await db.execute({
      sql: `SELECT mi.*, im.englishName as masterName, im.koreanName as masterKoreanName, im.unit as masterUnit
            FROM ManualIngredient mi
            LEFT JOIN IngredientMaster im ON mi.ingredientId = im.id
            WHERE mi.manualId = ?
            ORDER BY mi.sortOrder ASC`,
      args: [id],
    });
    
    // Parse cookingMethod if it's a string
    let cookingMethod = manual.cookingMethod;
    if (typeof cookingMethod === 'string') {
      try {
        cookingMethod = JSON.parse(cookingMethod);
      } catch {
        // Keep as string if not valid JSON
      }
    }
    
    const response = {
      id: manual.id,
      name: manual.name,
      koreanName: manual.koreanName,
      yield: manual.yield,
      yieldUnit: manual.yieldUnit,
      sellingPrice: manual.sellingPrice,
      imageUrl: manual.imageUrl,
      shelfLife: manual.shelfLife,
      cookingMethod: cookingMethod,
      priceTemplateId: manual.priceTemplateId,
      isActive: manual.isActive === 1 || Boolean(manual.isActive),
      isArchived: manual.isArchived === 1 || Boolean(manual.isArchived),
      createdAt: manual.createdAt,
      updatedAt: manual.updatedAt,
      ingredients: ingredientsResult.rows.map(row => ({
        id: row.id,
        manualId: row.manualId,
        ingredientId: row.ingredientId,
        name: row.name,
        koreanName: row.koreanName,
        quantity: row.quantity,
        unit: row.unit,
        sortOrder: row.sortOrder,
        notes: row.notes,
        unitPrice: row.unitPrice,
        baseQuantity: row.baseQuantity,
        ingredientMaster: row.ingredientId ? {
          id: row.ingredientId,
          name: row.masterName,
          koreanName: row.masterKoreanName,
          unit: row.masterUnit
        } : null
      })),
    };
    
    console.log('✅ GET /api/manuals/[id] success:', id);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('❌ Error fetching manual:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manual', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// PUT /api/manuals/[id] - Update manual
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any)?.role;
  if (!hasPermission(userRole, 'canEdit')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await params;
  
  try {
    const body = await request.json();
    console.log('📝 PUT /api/manuals/[id] - Received body:', JSON.stringify(body, null, 2));
    
    const db = getDb();
    
    // Check if manual exists and get current data
    const existingResult = await db.execute({
      sql: `SELECT * FROM MenuManual WHERE id = ?`,
      args: [id],
    });
    
    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }
    
    const currentManual = existingResult.rows[0];
    
    // Get current ingredients for version history
    const currentIngredientsResult = await db.execute({
      sql: `SELECT * FROM ManualIngredient WHERE manualId = ? ORDER BY sortOrder ASC`,
      args: [id],
    });
    
    // Save version history if content is being changed (not just status changes)
    const isContentChange = body.name !== undefined || body.koreanName !== undefined || 
                            body.sellingPrice !== undefined || body.ingredients !== undefined ||
                            body.cookingMethod !== undefined || body.imageUrl !== undefined;
    
    if (isContentChange && !body.skipVersioning) {
      const versionId = `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const currentVersion = Number(currentManual.version) || 1;
      
      try {
        await db.execute({
          sql: `INSERT INTO ManualVersion (id, manualId, version, name, koreanName, sellingPrice, ingredients, cookingMethod, imageUrl, changeNote, changedBy, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            versionId,
            id,
            currentVersion,
            currentManual.name,
            currentManual.koreanName || null,
            currentManual.sellingPrice || null,
            JSON.stringify(currentIngredientsResult.rows),
            currentManual.cookingMethod || null,
            currentManual.imageUrl || null,
            body.changeNote || null,
            body.changedBy || null,
            new Date().toISOString()
          ],
        });
        console.log(`📜 Saved version ${currentVersion} for manual ${id}`);
      } catch (versionError: any) {
        // Version table might not exist yet - ignore
        console.warn('⚠️ Could not save version:', versionError?.message);
      }
    }
    
    // Build update query dynamically
    const updateFields: string[] = [];
    const updateArgs: any[] = [];
    
    if (body.name !== undefined) { updateFields.push('name = ?'); updateArgs.push(body.name); }
    if (body.koreanName !== undefined) { updateFields.push('koreanName = ?'); updateArgs.push(body.koreanName); }
    if (body.yield !== undefined) { updateFields.push('yield = ?'); updateArgs.push(body.yield); }
    if (body.yieldUnit !== undefined) { updateFields.push('yieldUnit = ?'); updateArgs.push(body.yieldUnit); }
    if (body.sellingPrice !== undefined) { updateFields.push('sellingPrice = ?'); updateArgs.push(body.sellingPrice ? parseFloat(body.sellingPrice) : null); }
    if (body.imageUrl !== undefined) { updateFields.push('imageUrl = ?'); updateArgs.push(body.imageUrl); }
    if (body.shelfLife !== undefined) { updateFields.push('shelfLife = ?'); updateArgs.push(body.shelfLife); }
    if (body.cookingMethod !== undefined) { updateFields.push('cookingMethod = ?'); updateArgs.push(body.cookingMethod ? JSON.stringify(body.cookingMethod) : null); }
    if (body.priceTemplateId !== undefined) { updateFields.push('priceTemplateId = ?'); updateArgs.push(body.priceTemplateId || null); }
    if (body.isActive !== undefined) { updateFields.push('isActive = ?'); updateArgs.push(body.isActive ? 1 : 0); }
    if (body.isArchived !== undefined) { updateFields.push('isArchived = ?'); updateArgs.push(body.isArchived ? 1 : 0); }
    
    // Increment version if content changed
    if (isContentChange && !body.skipVersioning) {
      const newVersion = (Number(currentManual.version) || 1) + 1;
      updateFields.push('version = ?');
      updateArgs.push(newVersion);
    }
    
    // Always update updatedAt
    updateFields.push('updatedAt = ?');
    updateArgs.push(new Date().toISOString());
    updateArgs.push(id);
    
    if (updateFields.length > 1) {
      await db.execute({
        sql: `UPDATE MenuManual SET ${updateFields.join(', ')} WHERE id = ?`,
        args: updateArgs,
      });
    }
    
    // Handle ingredients update
    if (body.ingredients !== undefined) {
      console.log('📝 Updating ingredients:', body.ingredients?.length || 0, 'items');
      
      // Delete existing ingredients
      await db.execute({
        sql: `DELETE FROM ManualIngredient WHERE manualId = ?`,
        args: [id],
      });
      
      // Create new ingredients
      if (body.ingredients && body.ingredients.length > 0) {
        const now = new Date().toISOString();
        for (let i = 0; i < body.ingredients.length; i++) {
          const ing = body.ingredients[i];
          const ingredientId = `ing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await db.execute({
            sql: `INSERT INTO ManualIngredient (id, manualId, ingredientId, name, koreanName, quantity, unit, sortOrder, notes, unitPrice, baseQuantity, createdAt, updatedAt) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              ingredientId,
              id,
              ing.ingredientId || null,
              ing.name || ing.koreanName || 'Unknown',
              ing.koreanName || null,
              parseFloat(ing.quantity) || 0,
              ing.unit || 'g',
              i,
              ing.notes || null,
              ing.unitPrice ?? null,
              ing.baseQuantity ?? null,
              now,
              now
            ],
          });
        }
      }
    }
    
    // Fetch and return updated manual
    const updatedResult = await db.execute({
      sql: `SELECT * FROM MenuManual WHERE id = ?`,
      args: [id],
    });
    
    const ingredientsResult = await db.execute({
      sql: `SELECT * FROM ManualIngredient WHERE manualId = ? ORDER BY sortOrder ASC`,
      args: [id],
    });
    
    const manual = updatedResult.rows[0];
    let cookingMethod = manual.cookingMethod;
    if (typeof cookingMethod === 'string') {
      try { cookingMethod = JSON.parse(cookingMethod); } catch { }
    }
    
    const response = {
      ...manual,
      isActive: manual.isActive === 1 || Boolean(manual.isActive),
      isArchived: manual.isArchived === 1 || Boolean(manual.isArchived),
      cookingMethod,
      ingredients: ingredientsResult.rows
    };
    
    console.log('✅ Manual updated successfully:', id);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('❌ Error updating manual:', error);
    return NextResponse.json(
      { error: 'Failed to update manual', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/manuals/[id] - Soft delete (move to Trash) or Permanent delete
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any)?.role;
  const { searchParams } = new URL(request.url);
  const permanent = searchParams.get('permanent') === 'true';

  // Permanent delete requires higher permission
  if (permanent && !hasPermission(userRole, 'canPermanentDelete')) {
    return NextResponse.json({ error: 'Permission denied for permanent delete' }, { status: 403 });
  }
  if (!permanent && !hasPermission(userRole, 'canDelete')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await params;
  
  try {
    const db = getDb();
    
    // Check if manual exists
    const existingResult = await db.execute({
      sql: `SELECT id FROM MenuManual WHERE id = ?`,
      args: [id],
    });
    
    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }
    
    if (permanent) {
      // Permanent delete - delete all related data first
      // Delete version history
      await db.execute({
        sql: `DELETE FROM ManualVersion WHERE manualId = ?`,
        args: [id],
      });
      
      // Delete ingredients
      await db.execute({
        sql: `DELETE FROM ManualIngredient WHERE manualId = ?`,
        args: [id],
      });
      
      // Delete the manual itself
      await db.execute({
        sql: `DELETE FROM MenuManual WHERE id = ?`,
        args: [id],
      });
      
      console.log('✅ Manual permanently deleted:', id);
      return NextResponse.json({ success: true, permanent: true });
    } else {
      // Soft delete - set isActive=false, isArchived=false (move to Trash)
      // Trash: isActive=0, isArchived=0
      // Archive: isActive=0, isArchived=1 (only master admin can see)
      await db.execute({
        sql: `UPDATE MenuManual SET isActive = 0, isArchived = 0, updatedAt = ? WHERE id = ?`,
        args: [new Date().toISOString(), id],
      });
      
      console.log('✅ Manual moved to trash:', id);
      return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    console.error('❌ Error deleting manual:', error);
    return NextResponse.json(
      { error: 'Failed to delete manual', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/manuals/[id] - Partial update (e.g., just sellingPrice)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any)?.role;
  if (!hasPermission(userRole, 'canEdit')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await params;
  
  try {
    const body = await request.json();
    console.log('📝 PATCH /api/manuals/[id] - Received body:', JSON.stringify(body, null, 2));
    
    const db = getDb();
    
    // Check if manual exists
    const existingResult = await db.execute({
      sql: `SELECT id FROM MenuManual WHERE id = ?`,
      args: [id],
    });
    
    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }
    
    // Build update query dynamically - only update fields that are provided
    const updateFields: string[] = [];
    const updateArgs: any[] = [];
    
    if (body.sellingPrice !== undefined) { 
      updateFields.push('sellingPrice = ?'); 
      updateArgs.push(body.sellingPrice !== null ? parseFloat(body.sellingPrice) : null); 
    }
    if (body.name !== undefined) { updateFields.push('name = ?'); updateArgs.push(body.name); }
    if (body.koreanName !== undefined) { updateFields.push('koreanName = ?'); updateArgs.push(body.koreanName); }
    if (body.isActive !== undefined) { updateFields.push('isActive = ?'); updateArgs.push(body.isActive ? 1 : 0); }
    if (body.isArchived !== undefined) { updateFields.push('isArchived = ?'); updateArgs.push(body.isArchived ? 1 : 0); }
    if (body.groupId !== undefined) { updateFields.push('groupId = ?'); updateArgs.push(body.groupId || null); }
    
    // Always update updatedAt
    updateFields.push('updatedAt = ?');
    updateArgs.push(new Date().toISOString());
    updateArgs.push(id);
    
    if (updateFields.length > 1) {
      await db.execute({
        sql: `UPDATE MenuManual SET ${updateFields.join(', ')} WHERE id = ?`,
        args: updateArgs,
      });
      console.log('✅ Manual patched successfully:', id, 'fields:', updateFields.slice(0, -1).join(', '));
    }
    
    // Fetch and return updated manual
    const updatedResult = await db.execute({
      sql: `SELECT * FROM MenuManual WHERE id = ?`,
      args: [id],
    });
    
    const manual = updatedResult.rows[0];
    
    return NextResponse.json({
      ...manual,
      isActive: manual.isActive === 1 || Boolean(manual.isActive),
      isArchived: manual.isArchived === 1 || Boolean(manual.isArchived),
    });
  } catch (error: any) {
    console.error('❌ Error patching manual:', error);
    return NextResponse.json(
      { error: 'Failed to patch manual', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}