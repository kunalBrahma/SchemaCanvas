import { Table, Relation } from '@/store/schemaStore';

/**
 * Normalized column structure with optional foreign key metadata
 */
export interface NormalizedColumn {
    name: string;
    type: string;
    primaryKey: boolean;
    nullable: boolean;
    unique: boolean;
    foreignKey?: {
        table: string;
        column: string;
    };
    default?: {
        kind: 'autoincrement' | 'uuid' | 'now' | 'value';
        value?: string; // For 'value' kind
    };
}

/**
 * Normalized table structure with columns keyed by column name
 */
export interface NormalizedTable {
    name: string;
    columns: {
        [columnName: string]: NormalizedColumn;
    };
}

/**
 * Normalized schema structure with tables keyed by table name
 * This is the generator-ready JSON format
 */
export interface NormalizedSchema {
    tables: {
        [tableName: string]: NormalizedTable;
    };
    positions?: {
        [tableName: string]: { x: number; y: number };
    };
}

/**
 * Pure function that normalizes canvas state (ID-based) into generator-ready JSON (name-based)
 * 
 * This function faithfully represents the input data structure. It does NOT validate:
 * - Reserved keywords (e.g., "user" in PostgreSQL) - Phase 5 validator will catch this
 * - Foreign keys on primary keys (design issue) - Phase 5 validator will warn about this
 * - Naming conventions - Phase 5 validator will check this
 * 
 * Known edge cases that are allowed but may be problematic:
 * 1. Columns can be both primaryKey: true AND have foreignKey metadata
 *    - This creates a one-to-one relationship where FK value must equal PK value
 *    - Usually not desired; Phase 5 validator should warn about this
 * 2. Table/column names can be reserved keywords (e.g., "user", "order")
 *    - Will break SQL/Prisma generation without quoting
 *    - Phase 5 validator should catch and suggest alternatives (e.g., "users", "orders")
 * 
 * @param tables - Array of tables with ID-based structure
 * @param relations - Array of relations connecting columns
 * @param positions - Optional map of table IDs to their positions { [tableId]: { x, y } }
 * @returns Normalized schema with FK metadata embedded in columns
 */
export function normalizeSchema(tables: Table[], relations: Relation[], positions?: { [tableId: string]: { x: number; y: number } }): NormalizedSchema {
    // Build ID → Name lookup maps
    const tableNameMap = new Map<string, string>();
    const columnNameMap = new Map<string, { tableId: string; columnName: string }>();

    // Populate lookup maps
    for (const table of tables) {
        tableNameMap.set(table.id, table.name);
        for (const column of table.columns) {
            columnNameMap.set(`${table.id}::${column.id}`, {
                tableId: table.id,
                columnName: column.name,
            });
        }
    }

    // Build FK metadata map: targetTableId::targetColumnId → { table, column }
    const foreignKeyMap = new Map<string, { table: string; column: string }>();

    for (const relation of relations) {
        // Resolve source (PK side)
        const sourceTableName = tableNameMap.get(relation.fromTableId);
        const sourceColumnInfo = columnNameMap.get(`${relation.fromTableId}::${relation.fromColumnId}`);

        // Resolve target (FK side)
        const targetTableName = tableNameMap.get(relation.toTableId);
        const targetColumnInfo = columnNameMap.get(`${relation.toTableId}::${relation.toColumnId}`);

        // Skip if any reference is missing (orphaned relation)
        if (!sourceTableName || !sourceColumnInfo || !targetTableName || !targetColumnInfo) {
            continue;
        }

        // Store FK metadata keyed by target table and column IDs
        const fkKey = `${relation.toTableId}::${relation.toColumnId}`;
        foreignKeyMap.set(fkKey, {
            table: sourceTableName,
            column: sourceColumnInfo.columnName,
        });
    }

    // Build normalized structure
    const normalizedTables: { [tableName: string]: NormalizedTable } = {};

    for (const table of tables) {
        const tableName = table.name;
        const columns: { [columnName: string]: NormalizedColumn } = {};

        for (const column of table.columns) {
            const columnKey = `${table.id}::${column.id}`;
            const fkMetadata = foreignKeyMap.get(columnKey);

            const normalizedColumn: NormalizedColumn = {
                name: column.name,
                type: column.type,
                primaryKey: column.primaryKey,
                nullable: column.nullable,
                unique: column.unique,
            };

            // Attach FK metadata if this column is a foreign key
            // Note: A column can be both primaryKey: true AND have foreignKey metadata
            // This represents a one-to-one relationship (FK value must equal PK value)
            // Phase 5 validator should warn about this design pattern
            if (fkMetadata) {
                normalizedColumn.foreignKey = fkMetadata;
            }

            // Pass through default metadata if present
            if (column.default) {
                normalizedColumn.default = column.default;
            }

            columns[column.name] = normalizedColumn;
        }

        normalizedTables[tableName] = {
            name: tableName,
            columns,
        };
    }

    const result: NormalizedSchema = {
        tables: normalizedTables,
    };

    // Include positions if provided, converting table IDs to table names
    if (positions && Object.keys(positions).length > 0) {
        const positionsByTableName: { [tableName: string]: { x: number; y: number } } = {};
        for (const [tableId, position] of Object.entries(positions)) {
            const tableName = tableNameMap.get(tableId);
            if (tableName) {
                positionsByTableName[tableName] = position;
            }
        }
        if (Object.keys(positionsByTableName).length > 0) {
            result.positions = positionsByTableName;
        }
    }

    return result;
}

