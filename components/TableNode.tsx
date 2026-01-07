'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useSchemaStore, Column } from '@/store/schemaStore';
import ColumnRow from './ColumnRow';

export interface TableNodeData {
    name: string;
    [key: string]: unknown;
}

// @ts-expect-error - React Flow NodeProps constraint expects full Node type but works with data type
const TableNode = ({ id: nodeId, data: nodeData }: NodeProps<TableNodeData>) => {
    const { tables, updateTableName, deleteTable, addColumn } = useSchemaStore();

    // Type-safe data extraction
    const data = nodeData as TableNodeData;
    const id = nodeId as string;

    // Get the full table data from Zustand store
    const table = tables.find((t: { id: string }) => t.id === id);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateTableName(id, e.target.value);
    };

    const handleDelete = () => {
        deleteTable(id);
    };

    const handleAddColumn = () => {
        addColumn(id);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-w-[280px] max-w-[800px]">
            {/* Handles for future relations */}
            <Handle
                type="target"
                position={Position.Left}
                className="w-3 h-3 bg-blue-500"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="w-3 h-3 bg-blue-500"
            />

            {/* Header section */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-t-lg px-4 py-3 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                <input
                    type="text"
                    value={data.name}
                    onChange={handleNameChange}
                    className="flex-1 font-semibold text-gray-800 dark:text-gray-100 bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white dark:focus:bg-gray-600 rounded px-2 py-1 -mx-2 -my-1"
                    placeholder="Table name"
                />
                <button
                    onClick={handleDelete}
                    className="ml-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors"
                    title="Delete table"
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

            {/* Add Column Button */}
            <div className="px-3 py-2 border-b border-gray-200">
                <button
                    onClick={handleAddColumn}
                    className="w-full px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors flex items-center justify-center gap-1.5 font-medium"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                            clipRule="evenodd"
                        />
                    </svg>
                    Add Column
                </button>
            </div>

            {/* Columns List */}
            <div className="max-h-[400px] overflow-y-auto">
                {table?.columns && table.columns.length > 0 ? (
                    table.columns.map((column: { id: string }) => (
                        <ColumnRow key={column.id} tableId={id} column={column as Column} />
                    ))
                ) : (
                    <div className="px-4 py-3 text-gray-400 text-sm italic text-center">
                        No columns yet
                    </div>
                )}
            </div>
        </div>
    );
};

export default memo(TableNode);
