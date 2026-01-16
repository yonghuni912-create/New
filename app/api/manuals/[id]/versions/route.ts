import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}

// GET /api/manuals/[id]/versions - Get version history
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const db = getDb();
    
    // Get all versions for this manual
    const versionsResult = await db.execute({
      sql: `SELECT * FROM ManualVersion WHERE manualId = ? ORDER BY version DESC`,
      args: [id],
    });
    
    // Get current manual info
    const currentResult = await db.execute({
      sql: `SELECT id, name, version, updatedAt FROM MenuManual WHERE id = ?`,
      args: [id],
    });
    
    if (currentResult.rows.length === 0) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }
    
    const current = currentResult.rows[0];
    
    const versions = versionsResult.rows.map((row: any) => ({
      id: row.id,
      version: row.version,
      name: row.name,
      koreanName: row.koreanName,
      sellingPrice: row.sellingPrice,
      ingredients: row.ingredients ? JSON.parse(row.ingredients) : [],
      cookingMethod: row.cookingMethod ? JSON.parse(row.cookingMethod) : null,
      imageUrl: row.imageUrl,
      changeNote: row.changeNote,
      changedBy: row.changedBy,
      createdAt: row.createdAt,
    }));
    
    console.log(`✅ Found ${versions.length} versions for manual ${id}`);
    
    return NextResponse.json({
      manualId: id,
      currentVersion: current.version || 1,
      currentName: current.name,
      lastUpdated: current.updatedAt,
      versions,
    });
  } catch (error: any) {
    console.error('❌ Error fetching versions:', error);
    
    // Table might not exist
    if (error?.message?.includes('no such table')) {
      return NextResponse.json({
        manualId: id,
        currentVersion: 1,
        versions: [],
        message: 'Version history not available. Run migration first.'
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch versions', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// POST /api/manuals/[id]/versions - Restore a specific version
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    const { versionId } = body;
    
    if (!versionId) {
      return NextResponse.json({ error: 'versionId is required' }, { status: 400 });
    }
    
    const db = getDb();
    
    // Get the version to restore
    const versionResult = await db.execute({
      sql: `SELECT * FROM ManualVersion WHERE id = ? AND manualId = ?`,
      args: [versionId, id],
    });
    
    if (versionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    
    const versionToRestore = versionResult.rows[0];
    
    // Get current manual for saving as new version before restore
    const currentResult = await db.execute({
      sql: `SELECT * FROM MenuManual WHERE id = ?`,
      args: [id],
    });
    
    if (currentResult.rows.length === 0) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }
    
    const current = currentResult.rows[0];
    const currentVersion = Number(current.version) || 1;
    
    // Save current as a version before restoring
    const currentIngredients = await db.execute({
      sql: `SELECT * FROM ManualIngredient WHERE manualId = ? ORDER BY sortOrder ASC`,
      args: [id],
    });
    
    const newVersionId = `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.execute({
      sql: `INSERT INTO ManualVersion (id, manualId, version, name, koreanName, sellingPrice, ingredients, cookingMethod, imageUrl, changeNote, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newVersionId,
        id,
        currentVersion,
        current.name,
        current.koreanName,
        current.sellingPrice,
        JSON.stringify(currentIngredients.rows),
        current.cookingMethod,
        current.imageUrl,
        `Replaced by restoring version ${versionToRestore.version}`,
        new Date().toISOString()
      ],
    });
    
    // Restore the selected version
    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE MenuManual SET name = ?, koreanName = ?, sellingPrice = ?, cookingMethod = ?, imageUrl = ?, version = ?, updatedAt = ? WHERE id = ?`,
      args: [
        versionToRestore.name,
        versionToRestore.koreanName,
        versionToRestore.sellingPrice,
        versionToRestore.cookingMethod,
        versionToRestore.imageUrl,
        currentVersion + 1,
        now,
        id
      ],
    });
    
    // Restore ingredients
    await db.execute({
      sql: `DELETE FROM ManualIngredient WHERE manualId = ?`,
      args: [id],
    });
    
    const restoredIngredients = versionToRestore.ingredients ? JSON.parse(versionToRestore.ingredients as string) : [];
    for (const ing of restoredIngredients) {
      const ingredientId = `ing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.execute({
        sql: `INSERT INTO ManualIngredient (id, manualId, ingredientId, name, koreanName, quantity, unit, sortOrder, notes, unitPrice, baseQuantity)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ingredientId,
          id,
          ing.ingredientId || null,
          ing.name || 'Unknown',
          ing.koreanName || null,
          ing.quantity || 0,
          ing.unit || 'g',
          ing.sortOrder || 0,
          ing.notes || null,
          ing.unitPrice || null,
          ing.baseQuantity || null
        ],
      });
    }
    
    console.log(`✅ Restored manual ${id} to version ${versionToRestore.version}`);
    
    return NextResponse.json({
      success: true,
      message: `Restored to version ${versionToRestore.version}`,
      newVersion: currentVersion + 1,
    });
  } catch (error: any) {
    console.error('❌ Error restoring version:', error);
    return NextResponse.json(
      { error: 'Failed to restore version', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
