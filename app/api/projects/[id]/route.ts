import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NormalizedSchema } from '@/lib/schemaNormalizer';

/**
 * GET /api/projects/[id]
 * Loads a project by ID
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const project = await prisma.project.findUnique({
            where: { id },
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json({
            id: project.id,
            name: project.name,
            schema: project.schema as unknown as NormalizedSchema,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
        });
    } catch (error) {
        console.error('Failed to load project:', error);
        return NextResponse.json({ error: 'Failed to load project' }, { status: 500 });
    }
}

/**
 * PUT /api/projects/[id]
 * Updates a project
 */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, schema } = body;

        const updates: Record<string, unknown> = {};
        if (name !== undefined) {
            updates.name = name;
        }
        if (schema !== undefined) {
            updates.schema = schema;
        }

        const project = await prisma.project.update({
            where: { id },
            data: updates as Parameters<typeof prisma.project.update>[0]['data'],
        });

        return NextResponse.json({
            id: project.id,
            name: project.name,
            schema: project.schema as unknown as NormalizedSchema,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
        });
    } catch (error) {
        console.error('Failed to update project:', error);
        // Handle Prisma not found error
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }
}

/**
 * DELETE /api/projects/[id]
 * Deletes a project
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.project.delete({
            where: { id },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete project:', error);
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }
}

