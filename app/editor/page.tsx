'use client';

import React, { useCallback, useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    Node,
    Edge,
    Connection,
    NodeTypes,
    BackgroundVariant,
    OnNodesChange,
    OnEdgesChange,
    applyNodeChanges,
    applyEdgeChanges,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from "sonner";

import TableNode, { TableNodeData } from '@/components/TableNode';
import ExportPanel from '@/components/ExportPanel';
import { useSchemaStore, Table, Column, Relation } from '@/store/schemaStore';
import { validateSchema } from '@/lib/schemaValidator';
import { denormalizeSchema } from '@/lib/schemaDenormalizer';
import { normalizeSchema, NormalizedSchema } from '@/lib/schemaNormalizer';
import { ThemeToggle } from '@/components/ThemeToggle';

const nodeTypes = {
    tableNode: TableNode,
} as const;

function EditorPageContent() {
    const { tables, relations, addTable, addRelation, updateRelation, removeRelation, getNormalizedSchema, loadSchema, setNormalized } = useSchemaStore();
    const searchParams = useSearchParams();
    const router = useRouter(); // Use App Router

    // Local state for React Flow nodes/edges (enables dragging)
    const [nodes, setNodes] = useState<Node<TableNodeData>[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

    // Project state
    const [projectId, setProjectId] = useState<string | null>(null);
    const [projectName, setProjectName] = useState<string>('Untitled Project');

    // Instructions panel state
    const [instructionsExpanded, setInstructionsExpanded] = useState<boolean>(true);

    // Project list modal state
    const [showProjectList, setShowProjectList] = useState<boolean>(false);
    const [projectsList, setProjectsList] = useState<Array<{ id: string; name: string; updatedAt: string }>>([]);
    const [loadingProjects, setLoadingProjects] = useState<boolean>(false);

    // Saved positions for restoration (keyed by table ID)
    const [savedPositions, setSavedPositions] = useState<{ [tableId: string]: { x: number; y: number } } | null>(null);
    const hasLoadedRef = useRef(false);

    // Sync Zustand tables to React Flow nodes
    useEffect(() => {
        setNodes((nds: Node<TableNodeData>[]) => {
            const newNodes: Node<TableNodeData>[] = tables.map((table: Table, index: number) => {
                // Try to preserve existing position first
                const existingNode = nds.find((n) => n.id === table.id);
                if (existingNode) {
                    return {
                        id: table.id,
                        type: 'tableNode',
                        position: existingNode.position,
                        data: {
                            name: table.name,
                        },
                    };
                }

                // Then try saved position
                const savedPos = savedPositions?.[table.id];
                if (savedPos) {
                    return {
                        id: table.id,
                        type: 'tableNode',
                        position: savedPos,
                        data: {
                            name: table.name,
                        },
                    };
                }

                // Fall back to default position
                return {
                    id: table.id,
                    type: 'tableNode',
                    position: {
                        x: 100 + (index % 3) * 350,
                        y: 100 + Math.floor(index / 3) * 250,
                    },
                    data: {
                        name: table.name,
                    },
                };
            });
            return newNodes as Node<TableNodeData>[];
        });
    }, [tables, savedPositions]);

    // Sync Zustand relations to React Flow edges with improved styling
    // Only create edges if both source and target nodes exist
    // Sync Zustand relations to React Flow edges with improved styling
    // Only create edges if both source and target tables exist
    useEffect(() => {
        const tableIds = new Set(tables.map((t) => t.id));
        const validEdges = relations
            .filter((rel: Relation) => tableIds.has(rel.fromTableId) && tableIds.has(rel.toTableId))
            .map((relation: Relation) => ({
                id: relation.id,
                source: relation.fromTableId,
                target: relation.toTableId,
                sourceHandle: `${relation.fromTableId}::${relation.fromColumnId}`,
                targetHandle: `${relation.toTableId}::${relation.toColumnId}`,
                type: 'smoothstep',
                animated: false,
                style: {
                    stroke: '#3b82f6',
                    strokeWidth: 2,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 20,
                    height: 20,
                    color: '#3b82f6',
                },
            }));
        setEdges(validEdges);
    }, [relations, tables]);

    const handleAddTable = useCallback(() => {
        addTable();
    }, [addTable]);

    const handleTestNormalization = useCallback(() => {
        const normalized = getNormalizedSchema();
        console.log('Normalized Schema:', JSON.stringify(normalized, null, 2));

        // Run validation
        const validationResult = validateSchema(normalized);
        console.log('Validation Result:', validationResult);

        if (validationResult.valid) {
            setNormalized(true); // Mark as normalized when validation passes
            toast.success('Schema is valid!', {
                description: 'No validation errors found',
                duration: 3000,
            });
        } else {
            const errorCount = validationResult.errors.length;
            const firstError = validationResult.errors[0];
            toast.error(`Schema has ${errorCount} error${errorCount > 1 ? 's' : ''}`, {
                description: firstError.message,
                duration: 5000,
            });
            // Log each error with proper formatting
            console.group('Validation Errors');
            validationResult.errors.forEach((error, index) => {
                // Only add context if it provides additional info not already in the message
                const context: string[] = [];
                // Add table context only if message doesn't already mention the table name
                if (error.table && !error.message.includes(`'${error.table}'`) && !error.message.includes(`"${error.table}"`)) {
                    context.push(`Table: ${error.table}`);
                }
                // Add column context only if message doesn't already mention the column name
                if (error.column && !error.message.includes(`'${error.column}'`) && !error.message.includes(`"${error.column}"`)) {
                    context.push(`Column: ${error.column}`);
                }
                const contextStr = context.length > 0 ? ` (${context.join(', ')})` : '';
                console.error(`${index + 1}. [${error.code}] ${error.message}${contextStr}`);
            });
            console.groupEnd();
        }
    }, [getNormalizedSchema, setNormalized]);

    const handleSave = useCallback(async () => {
        try {
            // Capture current node positions
            const positions: { [tableId: string]: { x: number; y: number } } = {};
            nodes.forEach((node: Node<TableNodeData>) => {
                positions[node.id] = { x: node.position.x, y: node.position.y };
            });

            // Normalize schema with positions
            const normalized = normalizeSchema(tables, relations, positions);
            const name = projectName || 'Untitled Project';

            let response: Response;
            if (projectId) {
                // Update existing project
                response = await fetch(`/api/projects/${projectId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, schema: normalized }),
                });
            } else {
                // Create new project
                response = await fetch('/api/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, schema: normalized }),
                });
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save project');
            }

            const data = await response.json();
            setProjectId(data.id);
            setProjectName(data.name);
            toast.success('Project saved successfully!', {
                description: `Project ID: ${data.id}`,
                duration: 3000,
            });
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Failed to save project', {
                description: error instanceof Error ? error.message : 'Unknown error',
                duration: 5000,
            });
        }
    }, [projectId, projectName, tables, relations, nodes]);

    const handleLoad = useCallback(async (id?: string) => {
        if (!id) {
            // Show project list modal
            setShowProjectList(true);
            setLoadingProjects(true);
            try {
                const response = await fetch('/api/projects', { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error('Failed to fetch projects');
                }
                const projects = await response.json();
                setProjectsList(projects);
            } catch (error) {
                console.error('Error fetching projects:', error);
                toast.error('Failed to load projects list', {
                    description: 'Please try again',
                    duration: 3000,
                });
            } finally {
                setLoadingProjects(false);
            }
            return;
        }

        // Update URL to trigger the loading effect
        // Using router.push is cleaner and integrates with Next.js navigation
        router.push(`/editor?projectId=${id}`);
        setShowProjectList(false);
    }, [router]);

    const handleNewProject = useCallback(() => {
        loadSchema([], []);
        setProjectId(null);
        setProjectName('Untitled Project');
        setSavedPositions(null); // Clear saved positions for new project
        toast.success('New project created', { duration: 2000 });
    }, [loadSchema]);

    // Auto-load from URL parameter
    // Auto-load from URL parameter
    const loadingRef = useRef<string | null>(null);

    useEffect(() => {
        const urlProjectId = searchParams.get('projectId');

        // Case 1: URL has a project ID
        if (urlProjectId) {
            // Prevent double loading if we're already fetching this ID
            if (loadingRef.current === urlProjectId) return;

            // Only load if it's different from what's currently loaded
            if (urlProjectId !== projectId) {
                loadingRef.current = urlProjectId;

                // IMMEDIATE FIX: Clear existing state to prevent "flash" of old project
                loadSchema([], []);
                setProjectId(null); // Reset ID temporarily
                setProjectName('Loading...'); // UI indicator

                const loadProject = async () => {
                    try {
                        const response = await fetch(`/api/projects/${urlProjectId}`, { cache: 'no-store' });
                        if (!response.ok) {
                            if (response.status === 404) {
                                toast.error('Project not found');
                                return;
                            }
                            throw new Error('Failed to load project');
                        }

                        const project = await response.json();
                        const schema = project.schema as NormalizedSchema;

                        // Denormalize and load into store
                        const { tables: loadedTables, relations: loadedRelations, positions: loadedPositions } = denormalizeSchema(schema);
                        loadSchema(loadedTables, loadedRelations);

                        // Store positions for restoration (will be used by node sync useEffect)
                        if (loadedPositions) {
                            setSavedPositions(loadedPositions);
                        } else {
                            setSavedPositions(null);
                        }

                        setProjectId(project.id);
                        setProjectName(project.name);
                        toast.success('Project loaded successfully!', {
                            description: project.name,
                            duration: 3000,
                        });
                    } catch (error) {
                        console.error('Load error:', error);
                        toast.error('Failed to load project', {
                            description: error instanceof Error ? error.message : 'Unknown error',
                            duration: 5000,
                        });
                    } finally {
                        loadingRef.current = null;
                    }
                };
                loadProject();
            }
        }
        // Case 2: No project ID in URL -> New Project Mode
        else if (projectId !== null) {
            handleNewProject();
        }
    }, [searchParams, projectId, loadSchema, handleNewProject]);

    // Enable node dragging
    const onNodesChange: OnNodesChange = useCallback((changes) => {
        setNodes((nds) => applyNodeChanges(changes, nds) as Node<TableNodeData>[]);
    }, []);

    // Enable edge deletion and sync to store
    const onEdgesChange: OnEdgesChange = useCallback((changes) => {
        setEdges((eds) => {
            const newEdges = applyEdgeChanges(changes, eds);

            // Detect deletions and sync to store
            changes.forEach((change) => {
                if (change.type === 'remove') {
                    removeRelation(change.id);
                }
            });

            return newEdges;
        });
    }, [removeRelation]);

    // Validate connection before React Flow creates the edge
    const isValidConnection = useCallback((connection: Connection | Edge) => {
        if (!connection.sourceHandle || !connection.targetHandle) {
            return false;
        }

        const [sourceTableId, sourceColumnId] = connection.sourceHandle.split('::');
        const sourceTable = tables.find((t: Table) => t.id === sourceTableId);
        const sourceColumn = sourceTable?.columns.find((c: Column) => c.id === sourceColumnId);

        // Source must be Primary Key
        return sourceColumn?.primaryKey === true;
    }, [tables]);

    const handleConnect = useCallback(
        (connection: Connection) => {
            // Extract tableId and columnId from handle IDs
            if (!connection.sourceHandle || !connection.targetHandle) {
                toast.error('Invalid connection: missing handles');
                return;
            }

            const [sourceTableId, sourceColumnId] = connection.sourceHandle.split('::');
            const [targetTableId, targetColumnId] = connection.targetHandle.split('::');

            // Find source table and column
            const sourceTable = tables.find((t: Table) => t.id === sourceTableId);
            if (!sourceTable) {
                toast.error('Source table not found');
                return;
            }

            const sourceColumn = sourceTable.columns.find((c: Column) => c.id === sourceColumnId);
            if (!sourceColumn) {
                toast.error('Source column not found');
                return;
            }

            // Validate: source must be a Primary Key
            if (!sourceColumn.primaryKey) {
                toast.error('Connection rejected: Source column must be a Primary Key', {
                    description: 'Only columns marked as PK can be used as the source of a relationship',
                    duration: 4000,
                });
                return;
            }

            // Find target table and column for success message
            const targetTable = tables.find((t: Table) => t.id === targetTableId);
            const targetColumn = targetTable?.columns.find((c: Column) => c.id === targetColumnId);

            // Add relation
            addRelation({
                fromTableId: sourceTableId,
                fromColumnId: sourceColumnId,
                toTableId: targetTableId,
                toColumnId: targetColumnId,
            });

            // Success notification
            toast.success('Relationship created successfully', {
                description: `${sourceTable.name}.${sourceColumn.name} → ${targetTable?.name}.${targetColumn?.name}`,
                duration: 3000,
            });
        },
        [tables, addRelation]
    );

    const handleEdgesDelete = useCallback(
        (edgesToDelete: Edge[]) => {
            edgesToDelete.forEach((edge) => {
                removeRelation(edge.id);
            });

            if (edgesToDelete.length > 0) {
                setSelectedEdgeId(null);
                toast.success(`Deleted ${edgesToDelete.length} relationship${edgesToDelete.length > 1 ? 's' : ''}`, {
                    duration: 2000,
                });
            }
        },
        [removeRelation]
    );

    const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
        event.stopPropagation();
        setSelectedEdgeId(edge.id);
    }, []);

    const handlePaneClick = useCallback(() => {
        setSelectedEdgeId(null);
    }, []);

    const handleDeleteSelectedEdge = useCallback(() => {
        if (selectedEdgeId) {
            removeRelation(selectedEdgeId);
            setSelectedEdgeId(null);
            toast.success('Relationship deleted', { duration: 2000 });
        }
    }, [selectedEdgeId, removeRelation]);

    const handleUpdateTargetColumn = useCallback((newTargetColumnId: string) => {
        if (!selectedEdgeId) return;

        const relation = relations.find((r: Relation) => r.id === selectedEdgeId);
        if (!relation) return;

        // Parse the new target column handle
        const [targetTableId, targetColumnId] = newTargetColumnId.split('::');

        updateRelation(selectedEdgeId, {
            toTableId: targetTableId,
            toColumnId: targetColumnId,
        });

        const targetTable = tables.find((t: Table) => t.id === targetTableId);
        const targetColumn = targetTable?.columns.find((c: Column) => c.id === targetColumnId);
        toast.success('Relationship updated', {
            description: `Target changed to ${targetTable?.name}.${targetColumn?.name}`,
            duration: 2000,
        });
    }, [selectedEdgeId, relations, tables, updateRelation]);

    return (
        <div className="h-screen flex flex-col bg-white dark:bg-gray-950">
            <ReactFlow
                nodes={nodes}
                edges={edges.map((edge) => {
                    const isSelected = edge.id === selectedEdgeId;
                    // Only creating new object if selection status changes effectively
                    // But for now, map is fine as long as useEffect doesn't loop.
                    return {
                        ...edge,
                        selected: isSelected,
                        style: {
                            ...edge.style,
                            stroke: isSelected ? '#1d4ed8' : '#3b82f6',
                            strokeWidth: isSelected ? 3 : 2,
                        },
                        zIndex: isSelected ? 10 : 0,
                    };
                })}
                nodeTypes={nodeTypes as unknown as NodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={handleConnect}
                onEdgesDelete={handleEdgesDelete}
                onEdgeClick={handleEdgeClick}
                onPaneClick={handlePaneClick}
                isValidConnection={isValidConnection}
                connectionLineStyle={{
                    stroke: '#3b82f6',
                    strokeWidth: 3,
                    strokeDasharray: '8 4',
                }}
                defaultEdgeOptions={{
                    type: 'smoothstep',
                    animated: false,
                    style: { stroke: '#3b82f6', strokeWidth: 2 },
                }}
                fitView
                className="bg-gray-50 dark:bg-gray-900"
            >
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                <Controls className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 [&>button]:!bg-white dark:[&>button]:!bg-gray-800 [&>button]:!border-gray-200 dark:[&>button]:!border-gray-700 dark:[&>button]:!text-gray-100 [&>button:hover]:!bg-gray-50 dark:[&>button:hover]:!bg-gray-700" />
                <MiniMap
                    nodeColor={() => '#3b82f6'}
                    maskColor="rgba(0, 0, 0, 0.1)"
                    className="!bg-gray-100 dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700"
                />

                {/* Export Panel */}
                <ExportPanel />

                {/* Floating Action Buttons - Minimal Design */}
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                    <div className="flex gap-2">
                        <button
                            onClick={handleAddTable}
                            className="group bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 transition-all duration-200 flex items-center gap-2"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <span className="text-sm">Add Table</span>
                        </button>
                        {/* Theme Toggle */}
                        <ThemeToggle />
                        <button
                            onClick={handleTestNormalization}
                            className="group bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 transition-all duration-200 flex items-center gap-2"
                            title="Test schema normalization (check console)"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <span className="text-sm">Normalise</span>
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            className="group bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 transition-all duration-200 flex items-center gap-2"
                            title={projectId ? 'Update project' : 'Save new project'}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                            </svg>
                            <span className="text-sm">{projectId ? 'Update' : 'Save'}</span>
                        </button>
                        <button
                            onClick={() => handleLoad()}
                            className="group bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 transition-all duration-200 flex items-center gap-2"
                            title="Load project by ID"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                                <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11a1 1 0 102 0v-1a1 1 0 00-1-1h-1a1 1 0 100 2h1v1z" />
                            </svg>
                            <span className="text-sm">Load</span>
                        </button>
                        <button
                            onClick={handleNewProject}
                            className="group bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 transition-all duration-200 flex items-center gap-2"
                            title="Start new project"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <span className="text-sm">New</span>
                        </button>
                    </div>
                    {projectId && (
                        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    {projectName}
                                </span>
                                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                    ({projectId.slice(0, 8)}...)
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Edge Selection Panel */}
                {selectedEdgeId && (() => {
                    const relation = relations.find((relation: Relation) => relation.id === selectedEdgeId);
                    if (!relation) return null;

                    const sourceTable = tables.find((t: Table) => t.id === relation.fromTableId);
                    const sourceColumn = sourceTable?.columns.find((c: Column) => c.id === relation.fromColumnId);

                    return (
                        <div className="absolute top-32 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-10 border border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-sm text-gray-900">Edit Relationship</h3>
                                <button
                                    onClick={() => setSelectedEdgeId(null)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-3 mb-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">
                                        From (Source)
                                    </label>
                                    <div className="text-sm text-gray-900 bg-gray-50 px-2 py-1.5 rounded border border-gray-200">
                                        {sourceTable?.name}.{sourceColumn?.name}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">
                                        To (Target)
                                    </label>
                                    <select
                                        value={`${relation.toTableId}:: ${relation.toColumnId}`}
                                        onChange={(e) => handleUpdateTargetColumn(e.target.value)}
                                        className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                                    >
                                        {tables.map((table: Table) =>
                                            table.columns.map((column: Column) => (
                                                <option
                                                    key={`${table.id}:: ${column.id}`}
                                                    value={`${table.id}:: ${column.id}`}
                                                >
                                                    {table.name}.{column.name}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleDeleteSelectedEdge}
                                className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                Delete Relationship
                            </button>
                        </div>
                    );
                })()}

                {/* Instructions Panel - Minimal Design */}
                {!selectedEdgeId && (
                    <div className="absolute bottom-4 right-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-sm z-10 border border-gray-200 dark:border-gray-700 w-64">
                        <button
                            onClick={() => setInstructionsExpanded(!instructionsExpanded)}
                            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors rounded-t-lg"
                        >
                            <div className="flex items-center gap-2">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                <h3 className="font-medium text-xs text-gray-700 dark:text-gray-300">Quick Guide</h3>
                            </div>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`h-3.5 w-3.5 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${instructionsExpanded ? 'rotate-180' : ''}`}
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>
                        {instructionsExpanded && (
                            <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700">
                                <div className="space-y-2.5">
                                    {/* Instructions */}
                                    <ul className="space-y-1.5 text-[10px] text-gray-600 dark:text-gray-400">
                                        <li className="flex items-start gap-1.5">
                                            <span className="text-gray-400 dark:text-gray-500 mt-0.5">•</span>
                                            <span><strong className="text-gray-700 dark:text-gray-300 font-medium">Tables:</strong> "Add Table" to create</span>
                                        </li>
                                        <li className="flex items-start gap-1.5">
                                            <span className="text-gray-400 dark:text-gray-500 mt-0.5">•</span>
                                            <span><strong className="text-gray-700 dark:text-gray-300 font-medium">Relations:</strong> Drag PK to target</span>
                                        </li>
                                        <li className="flex items-start gap-1.5">
                                            <span className="text-gray-400 dark:text-gray-500 mt-0.5">•</span>
                                            <span><strong className="text-gray-700 dark:text-gray-300 font-medium">Export:</strong> See right panel</span>
                                        </li>
                                    </ul>

                                    {/* Column Badges */}
                                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                                        <h4 className="text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Column Badges:</h4>
                                        <ul className="space-y-1.5 text-[10px] text-gray-600 dark:text-gray-400">
                                            <li className="flex items-center gap-1.5">
                                                <span className="px-1 py-0.5 text-[9px] font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">PK</span>
                                                <span><strong className="text-gray-700 dark:text-gray-300">Primary Key</strong></span>
                                            </li>
                                            <li className="flex items-center gap-1.5">
                                                <span className="px-1 py-0.5 text-[9px] font-medium rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">N</span>
                                                <span><strong className="text-gray-700 dark:text-gray-300">Nullable</strong></span>
                                            </li>
                                            <li className="flex items-center gap-1.5">
                                                <span className="px-1 py-0.5 text-[9px] font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">U</span>
                                                <span><strong className="text-gray-700 dark:text-gray-300">Unique</strong></span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </ReactFlow>

            {/* Project List Modal */}
            {showProjectList && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Load Project</h2>
                            <button
                                onClick={() => setShowProjectList(false)}
                                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingProjects ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-center">
                                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                                        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Loading projects...</p>
                                    </div>
                                </div>
                            ) : projectsList.length === 0 ? (
                                <div className="text-center py-12">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                                        />
                                    </svg>
                                    <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">No projects yet</h3>
                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Save a project to see it here</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {projectsList.map((project) => (
                                        <button
                                            key={project.id}
                                            onClick={() => handleLoad(project.id)}
                                            className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                                        {project.name}
                                                    </h3>
                                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                                                        ID: {project.id}
                                                    </p>
                                                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                                        Updated: {new Date(project.updatedAt).toLocaleString()}
                                                    </p>
                                                </div>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0"
                                                    viewBox="0 0 20 20"
                                                    fill="currentColor"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function EditorPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-950">
                <div className="text-gray-500 dark:text-gray-400">Loading editor...</div>
            </div>
        }>
            <EditorPageContent />
        </Suspense>
    );
}
