import { NormalizedSchema } from './schemaNormalizer';
import { Table, Column, Relation } from '@/store/schemaStore';

/**
 * Converts a normalized schema (name-based) back to editor state (ID-based)
 * 
 * This function:
 * - Generates new UUIDs for tables and columns
 * - Reconstructs relations from FK metadata
 * - Returns tables and relations in the format expected by the editor
 * - Extracts and returns positions if available
 * 
 * @param schema - Normalized schema to denormalize
 * @returns Editor state with tables, relations, and positions containing IDs
 */
export function denormalizeSchema(schema: NormalizedSchema): { tables: Table[]; relations: Relation[]; positions?: { [tableId: string]: { x: number; y: number } } } {
    const tables: Table[] = [];
    const relations: Relation[] = [];

    // Map: tableName → { tableId, columnMap: columnName → columnId }
    const tableMap = new Map<string, { tableId: string; columnMap: Map<string, string> }>();

    // Step 1: Create tables and columns with new IDs
    for (const [tableName, table] of Object.entries(schema.tables)) {
        const tableId = crypto.randomUUID();
        const columnMap = new Map<string, string>();
        const columns: Column[] = [];

        for (const [columnName, column] of Object.entries(table.columns)) {
            const columnId = crypto.randomUUID();
            columnMap.set(columnName, columnId);

            const newColumn: Column = {
                id: columnId,
                name: column.name,
                type: column.type,
                primaryKey: column.primaryKey,
                nullable: column.nullable,
                unique: column.unique,
            };

            // Restore default value if present in normalized schema
            if (column.default) {
                newColumn.default = column.default;
            }

            columns.push(newColumn);
        }

        tables.push({
            id: tableId,
            name: table.name,
            columns,
        });

        tableMap.set(tableName, { tableId, columnMap });

        // Map positions from old table IDs to new table IDs
        // Since we generate new IDs, we need to find positions by matching table names
        // We'll need to store positions keyed by table name in the schema, or map them here
        // For now, we'll try to find positions by iterating through saved positions
        // and matching them to table names (if positions were stored with a name mapping)
    }

    // Step 2: Create relations from FK metadata
    // Relations go from PK (source) → FK (target)
    // The FK metadata on a column tells us: this column references another table's PK
    // So we need to reverse the direction when creating the relation
    for (const [tableName, table] of Object.entries(schema.tables)) {
        const fkTableInfo = tableMap.get(tableName);
        if (!fkTableInfo) continue;

        for (const [columnName, column] of Object.entries(table.columns)) {
            if (column.foreignKey) {
                const pkTableInfo = tableMap.get(column.foreignKey.table);
                if (!pkTableInfo) continue;

                // Get the FK column ID (the column that has the foreign key)
                const fkColumnId = fkTableInfo.columnMap.get(columnName);
                // Get the referenced PK column ID
                const pkColumnId = pkTableInfo.columnMap.get(column.foreignKey.column);

                if (fkColumnId && pkColumnId) {
                    // Relations must go from PK (source) to FK (target)
                    relations.push({
                        id: crypto.randomUUID(),
                        fromTableId: pkTableInfo.tableId,       // PK table is source
                        fromColumnId: pkColumnId,               // PK column is source
                        toTableId: fkTableInfo.tableId,         // FK table is target
                        toColumnId: fkColumnId,                 // FK column is target
                    });
                }
            }
        }
    }

    // Step 3: Map positions from schema (keyed by table name) to new table IDs
    const result: { tables: Table[]; relations: Relation[]; positions?: { [tableId: string]: { x: number; y: number } } } = {
        tables,
        relations,
    };

    // Map positions by table name to new table IDs
    if (schema.positions) {
        const positionsByTableId: { [tableId: string]: { x: number; y: number } } = {};
        for (const [tableName, position] of Object.entries(schema.positions)) {
            const tableInfo = tableMap.get(tableName);
            if (tableInfo) {
                positionsByTableId[tableInfo.tableId] = position;
            }
        }
        if (Object.keys(positionsByTableId).length > 0) {
            result.positions = positionsByTableId;
        }
    }

    return result;
}

