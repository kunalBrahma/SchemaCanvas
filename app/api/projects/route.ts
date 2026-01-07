import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/projects
 * Lists all projects
 */
export async function GET() {
    try {
        const projects = await prisma.project.findMany({
            select: {
                id: true,
                name: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
        return NextResponse.json(projects);
    } catch (error) {
        console.error('Failed to fetch projects:', error);
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }
}

/**
 * POST /api/projects
 * Creates a new project
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, schema } = body;

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
        }

        if (!schema) {
            return NextResponse.json({ error: 'Schema is required' }, { status: 400 });
        }

        const project = await prisma.project.create({
            data: {
                name,
                schema: schema as unknown as Parameters<typeof prisma.project.create>[0]['data']['schema'],
            },
        });

        return NextResponse.json({ id: project.id, name: project.name }, { status: 201 });
    } catch (error) {
        console.error('Failed to create project:', error);
        return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }
}

