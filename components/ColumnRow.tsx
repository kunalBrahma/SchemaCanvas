'use client';

import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useSchemaStore, Column, Table } from '@/store/schemaStore';

interface ColumnRowProps {
    tableId: string;
    column: Column;
}

const DATATYPES = ['int', 'varchar', 'text', 'boolean', 'timestamp', 'uuid'];

export default function ColumnRow({ tableId, column }: ColumnRowProps) {
    const { tables, updateColumn, deleteColumn } = useSchemaStore();
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Get the current table to check for other columns
    const currentTable = tables.find((t: Table) => t.id === tableId);
    const otherColumns = currentTable?.columns.filter((c: Column) => c.id !== column.id) || [];

    // Check if another column in this table has autoincrement
    const hasOtherAutoincrement = otherColumns.some((c: Column) => c.default?.kind === 'autoincrement');

    // Determine which options are enabled
    const canUseAutoincrement = column.type === 'int' && column.primaryKey && !hasOtherAutoincrement;
    const canUseUUID = (column.type === 'uuid' || column.type === 'varchar') && column.primaryKey;
    const canUseNow = column.type === 'timestamp';

    // Check if UUID or autoincrement is currently set
    const hasAutoincrement = column.default?.kind === 'autoincrement';
    const hasUUID = column.default?.kind === 'uuid';
    const hasNow = column.default?.kind === 'now';
    const hasCustom = column.default?.kind === 'value';

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateColumn(tableId, column.id, { name: e.target.value });
    };

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value;
        const updates: Partial<Column> = { type: newType };

        // Clear incompatible defaults when type changes
        if (column.default) {
            if (newType !== 'int' && column.default.kind === 'autoincrement') {
                updates.default = undefined;
            } else if (newType !== 'timestamp' && column.default.kind === 'now') {
                updates.default = undefined;
            } else if ((newType !== 'uuid' && newType !== 'varchar') && column.default.kind === 'uuid') {
                updates.default = undefined;
            }
        }

        updateColumn(tableId, column.id, updates);
    };

    const handleToggle = (field: 'primaryKey' | 'nullable' | 'unique') => {
        const updates: Partial<Column> = { [field]: !column[field] };

        // Clear incompatible defaults when primaryKey is toggled off
        if (field === 'primaryKey' && column.primaryKey && column.default) {
            if (column.default.kind === 'autoincrement' || column.default.kind === 'uuid') {
                updates.default = undefined;
            }
        }

        updateColumn(tableId, column.id, updates);
    };

    const handleDefaultChange = (kind: 'autoincrement' | 'uuid' | 'now' | 'value' | null, value?: string) => {
        if (kind === null) {
            updateColumn(tableId, column.id, { default: undefined });
        } else if (kind === 'value') {
            updateColumn(tableId, column.id, { default: { kind: 'value', value: value || '' } });
        } else {
            updateColumn(tableId, column.id, { default: { kind } });
        }
    };

    const handleDelete = () => {
        deleteColumn(tableId, column.id);
    };

    // Unique handle ID for this column (using :: separator to avoid conflicts with UUID dashes)
    const handleId = `${tableId}::${column.id}`;

    return (
        <div className={`group relative border-b border-gray-100 dark:border-gray-700 last:border-b-0 overflow-visible ${column.primaryKey ? 'bg-blue-50/30 dark:bg-blue-900/20' : ''}`}>
            <div className={`flex items-center gap-2 px-3 py-2 text-sm ${column.primaryKey ? 'hover:bg-blue-100/50 dark:hover:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>

                {/* Visual Indicator for Target Handle - Left Side (always visible) */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-full">
                    <div className="w-2 h-2 rounded-full bg-blue-300 dark:bg-blue-500 group-hover:bg-blue-400 dark:group-hover:bg-blue-400 transition-colors" />
                </div>

                {/* Target Handle (always visible - left side) */}
                <Handle
                    type="target"
                    position={Position.Left}
                    id={handleId}
                    className="!w-5 !h-5 !bg-blue-400 !border-2 !border-white !rounded-full !cursor-crosshair hover:!scale-150 hover:!bg-blue-500 hover:!shadow-lg hover:!shadow-blue-400/50 !transition-all !duration-200 opacity-0 hover:opacity-100"
                    style={{ left: 0 }}
                    title="Drop here to create relationship"
                />


                {/* Column Name */}
                <input
                    type="text"
                    value={column.name}
                    onChange={handleNameChange}
                    className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 max-w-[120px]"
                    placeholder="column_name"
                />

                {/* Type Dropdown */}
                <select
                    value={column.type}
                    onChange={handleTypeChange}
                    className="px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white shrink-0"
                >
                    {DATATYPES.map((type) => (
                        <option key={type} value={type}>
                            {type}
                        </option>
                    ))}
                </select>

                {/* Toggles */}
                <div className="flex items-center gap-1 shrink-0">
                    {/* Primary Key */}
                    <button
                        onClick={() => handleToggle('primaryKey')}
                        className={`px-1.5 py-0.5 text-xs font-medium rounded transition-colors ${column.primaryKey
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        title="Primary Key"
                    >
                        PK
                    </button>

                    {/* Nullable */}
                    <button
                        onClick={() => handleToggle('nullable')}
                        className={`px-1.5 py-0.5 text-xs font-medium rounded transition-colors ${column.nullable
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        title="Nullable"
                    >
                        N
                    </button>

                    {/* Unique */}
                    <button
                        onClick={() => handleToggle('unique')}
                        className={`px-1.5 py-0.5 text-xs font-medium rounded transition-colors ${column.unique
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        title="Unique"
                    >
                        U
                    </button>
                </div>

                {/* Connection Button for Primary Keys */}
                {column.primaryKey && (
                    <div className="relative shrink-0">
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={handleId}
                            className="!w-full !h-full !bg-transparent !border-0 !cursor-grab !absolute !inset-0 !rounded z-10"
                            title="Drag to create relationship"
                        />
                        <button
                            className="p-1.5 rounded transition-all shrink-0 bg-blue-500 hover:bg-blue-600 text-white shadow-sm hover:shadow-md relative"
                            title="Drag to create relationship from this Primary Key"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Advanced Settings Button */}
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={`p-1.5 rounded transition-colors shrink-0 ${showAdvanced
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    title="Advanced settings"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>

                {/* Delete Button */}
                <button
                    onClick={handleDelete}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors shrink-0"
                    title="Delete column"
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

            {/* Advanced Settings Panel */}
            {showAdvanced && (
                <div className="px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs">
                    <div className="space-y-2.5">
                        {/* Auto-increment */}
                        <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded">
                            <input
                                type="checkbox"
                                checked={hasAutoincrement}
                                disabled={!canUseAutoincrement || hasUUID}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        handleDefaultChange('autoincrement');
                                    } else {
                                        handleDefaultChange(null);
                                    }
                                }}
                                className="mt-0.5 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            />
                            <div className="flex-1">
                                <span className={`block font-medium ${!canUseAutoincrement || hasUUID ? 'text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                    Auto-increment
                                </span>
                                {(!canUseAutoincrement || hasUUID) && (
                                    <span className="block text-gray-400 dark:text-gray-500 text-xs mt-0.5">
                                        {!column.primaryKey ? '(Requires Primary Key)' :
                                            column.type !== 'int' ? '(Requires int type)' :
                                                hasOtherAutoincrement ? '(Only one per table)' :
                                                    hasUUID ? '(Cannot use with UUID)' : ''}
                                    </span>
                                )}
                            </div>
                        </label>

                        {/* UUID */}
                        <label className="flex items-start gap-2.5 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 p-2 rounded transition-colors">
                            <input
                                type="checkbox"
                                checked={hasUUID}
                                disabled={!canUseUUID || hasAutoincrement}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        handleDefaultChange('uuid');
                                    } else {
                                        handleDefaultChange(null);
                                    }
                                }}
                                className="mt-0.5 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            />
                            <div className="flex-1">
                                <span className={`block font-medium ${!canUseUUID || hasAutoincrement ? 'text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                    UUID
                                </span>
                                {(!canUseUUID || hasAutoincrement) && (
                                    <span className="block text-gray-400 dark:text-gray-500 text-xs mt-0.5">
                                        {!column.primaryKey ? '(Requires Primary Key)' :
                                            column.type !== 'uuid' && column.type !== 'varchar' ? '(Requires uuid/varchar type)' :
                                                hasAutoincrement ? '(Cannot use with auto-increment)' : ''}
                                    </span>
                                )}
                            </div>
                        </label>

                        {/* Now (timestamp) */}
                        <label className="flex items-start gap-2.5 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 p-2 rounded transition-colors">
                            <input
                                type="checkbox"
                                checked={hasNow}
                                disabled={!canUseNow}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        handleDefaultChange('now');
                                    } else {
                                        handleDefaultChange(null);
                                    }
                                }}
                                className="mt-0.5 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            />
                            <div className="flex-1">
                                <span className={`block font-medium ${!canUseNow ? 'text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                    Default = now()
                                </span>
                                {!canUseNow && (
                                    <span className="block text-gray-400 dark:text-gray-500 text-xs mt-0.5">
                                        (Requires timestamp type)
                                    </span>
                                )}
                            </div>
                        </label>

                        {/* Custom value */}
                        <div className="flex items-center gap-2 p-2">
                            <input
                                type="text"
                                value={hasCustom ? column.default?.value || '' : ''}
                                onChange={(e) => {
                                    if (e.target.value.trim()) {
                                        handleDefaultChange('value', e.target.value);
                                    } else {
                                        handleDefaultChange(null);
                                    }
                                }}
                                placeholder="Custom default value"
                                className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-400 dark:focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                            />
                            {hasCustom && (
                                <button
                                    onClick={() => handleDefaultChange(null)}
                                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                    title="Clear custom default"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-3 w-3"
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
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
