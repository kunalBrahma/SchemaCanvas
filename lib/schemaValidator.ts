import { NormalizedSchema } from './schemaNormalizer';

/**
 * Validation error with metadata for UI mapping
 */
export interface ValidationError {
    code: string;
    message: string;
    table?: string;
    column?: string;
}

/**
 * Validation result containing validity status and all errors
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

/**
 * PostgreSQL reserved keywords that must not be used as table/column names
 */
const RESERVED_KEYWORDS = [
    'user',
    'order',
    'select',
    'table',
    'group',
    'where',
    'index',
];

/**
 * Check if a name follows snake_case convention
 * Rules:
 * - Must start with lowercase letter or underscore
 * - Can contain lowercase letters, numbers, and underscores
 * - No consecutive underscores
 * - No uppercase letters
 */
function isSnakeCase(name: string): boolean {
    if (!name || name.trim().length === 0) {
        return false;
    }
    // Must start with letter or underscore, followed by letters, numbers, or underscores
    // No consecutive underscores
    const snakeCaseRegex = /^[a-z][a-z0-9_]*$|^_[a-z0-9_]+$/;
    if (!snakeCaseRegex.test(name)) {
        return false;
    }
    // Check for consecutive underscores
    if (name.includes('__')) {
        return false;
    }
    return true;
}

/**
 * Check if a name is a reserved keyword
 */
function isReservedKeyword(name: string): boolean {
    return RESERVED_KEYWORDS.includes(name.toLowerCase());
}

/**
 * Validate table-level rules
 */
function validateTables(schema: NormalizedSchema, errors: ValidationError[]): void {
    const tableNames = Object.keys(schema.tables);
    const seenTableNames = new Set<string>();

    for (const tableName of tableNames) {
        const table = schema.tables[tableName];

        // Check empty name
        if (!table.name || table.name.trim().length === 0) {
            errors.push({
                code: 'TABLE_EMPTY_NAME',
                message: 'Table name cannot be empty',
                table: tableName,
            });
        }

        // Check snake_case
        if (table.name && !isSnakeCase(table.name)) {
            errors.push({
                code: 'TABLE_NOT_SNAKE_CASE',
                message: `Table name '${table.name}' must be in snake_case (lowercase letters, numbers, underscores only)`,
                table: tableName,
            });
        }

        // Check reserved keyword
        if (table.name && isReservedKeyword(table.name)) {
            const suggestion = table.name.endsWith('s') ? table.name : `${table.name}s`;
            errors.push({
                code: 'TABLE_RESERVED_KEYWORD',
                message: `Table name '${table.name}' is a reserved keyword. Use '${suggestion}' instead.`,
                table: tableName,
            });
        }

        // Check uniqueness
        if (table.name && seenTableNames.has(table.name.toLowerCase())) {
            errors.push({
                code: 'TABLE_DUPLICATE',
                message: `Duplicate table name '${table.name}'`,
                table: tableName,
            });
        }
        if (table.name) {
            seenTableNames.add(table.name.toLowerCase());
        }

        // Check table has at least one column
        const columnNames = Object.keys(table.columns);
        if (columnNames.length === 0) {
            errors.push({
                code: 'TABLE_NO_COLUMNS',
                message: `Table '${table.name}' must have at least one column`,
                table: tableName,
            });
        }
    }
}

/**
 * Validate column-level rules
 */
function validateColumns(schema: NormalizedSchema, errors: ValidationError[]): void {
    for (const [tableName, table] of Object.entries(schema.tables)) {
        const columnNames = Object.keys(table.columns);
        const seenColumnNames = new Set<string>();
        const primaryKeys: string[] = [];

        for (const columnName of columnNames) {
            const column = table.columns[columnName];

            // Check empty name
            if (!column.name || column.name.trim().length === 0) {
                errors.push({
                    code: 'COLUMN_EMPTY_NAME',
                    message: 'Column name cannot be empty',
                    table: tableName,
                    column: columnName,
                });
            }

            // Check snake_case
            if (column.name && !isSnakeCase(column.name)) {
                errors.push({
                    code: 'COLUMN_NOT_SNAKE_CASE',
                    message: `Column name '${column.name}' must be in snake_case (lowercase letters, numbers, underscores only)`,
                    table: tableName,
                    column: columnName,
                });
            }

            // Check uniqueness within table
            if (column.name && seenColumnNames.has(column.name.toLowerCase())) {
                errors.push({
                    code: 'COLUMN_DUPLICATE',
                    message: `Duplicate column name '${column.name}' in table '${table.name}'`,
                    table: tableName,
                    column: columnName,
                });
            }
            if (column.name) {
                seenColumnNames.add(column.name.toLowerCase());
            }

            // Check column has type
            if (!column.type || column.type.trim().length === 0) {
                errors.push({
                    code: 'COLUMN_NO_TYPE',
                    message: `Column '${column.name}' in table '${table.name}' must have a datatype`,
                    table: tableName,
                    column: columnName,
                });
            }

            // Track primary keys
            if (column.primaryKey) {
                primaryKeys.push(columnName);
            }
        }

        // Check only one primary key per table
        if (primaryKeys.length > 1) {
            // Add error for each PK after the first
            for (let i = 1; i < primaryKeys.length; i++) {
                const pkColumnName = primaryKeys[i];
                errors.push({
                    code: 'COLUMN_MULTIPLE_PK',
                    message: `Table '${table.name}' has multiple primary keys. Only one primary key allowed per table.`,
                    table: tableName,
                    column: pkColumnName,
                });
            }
        }
    }
}

/**
 * Validate foreign key rules
 */
function validateForeignKeys(schema: NormalizedSchema, errors: ValidationError[]): void {
    for (const [tableName, table] of Object.entries(schema.tables)) {
        for (const [columnName, column] of Object.entries(table.columns)) {
            if (!column.foreignKey) {
                continue;
            }

            const fk = column.foreignKey;
            const referencedTableName = fk.table;
            const referencedColumnName = fk.column;

            // Check referenced table exists
            const referencedTable = schema.tables[referencedTableName];
            if (!referencedTable) {
                errors.push({
                    code: 'FK_TABLE_NOT_FOUND',
                    message: `Column '${column.name}' in table '${table.name}' references non-existent table '${referencedTableName}'`,
                    table: tableName,
                    column: columnName,
                });
                continue; // Skip further checks if table doesn't exist
            }

            // Check referenced column exists
            const referencedColumn = referencedTable.columns[referencedColumnName];
            if (!referencedColumn) {
                errors.push({
                    code: 'FK_COLUMN_NOT_FOUND',
                    message: `Column '${column.name}' in table '${table.name}' references non-existent column '${referencedColumnName}' in table '${referencedTableName}'`,
                    table: tableName,
                    column: columnName,
                });
                continue; // Skip further checks if column doesn't exist
            }

            // Check referenced column is a primary key
            if (!referencedColumn.primaryKey) {
                errors.push({
                    code: 'FK_NOT_PRIMARY_KEY',
                    message: `Column '${column.name}' in table '${table.name}' references column '${referencedColumnName}' in '${referencedTableName}', but '${referencedColumnName}' is not a primary key`,
                    table: tableName,
                    column: columnName,
                });
            }

            // Check type matching
            if (column.type && referencedColumn.type && column.type !== referencedColumn.type) {
                errors.push({
                    code: 'FK_TYPE_MISMATCH',
                    message: `Column '${column.name}' in table '${table.name}' has type '${column.type}' but references '${referencedTableName}.${referencedColumnName}' with type '${referencedColumn.type}'`,
                    table: tableName,
                    column: columnName,
                });
            }
        }
    }
}

/**
 * Validate default value rules
 */
function validateDefaults(schema: NormalizedSchema, errors: ValidationError[]): void {
    for (const [tableName, table] of Object.entries(schema.tables)) {
        const autoincrementColumns: string[] = [];

        for (const [columnName, column] of Object.entries(table.columns)) {
            if (!column.default) {
                continue;
            }

            const defaultKind = column.default.kind;

            // Validate autoincrement
            if (defaultKind === 'autoincrement') {
                // Check only one autoincrement per table
                if (autoincrementColumns.length > 0) {
                    errors.push({
                        code: 'COLUMN_MULTIPLE_AUTOINCREMENT',
                        message: `Table '${table.name}' has multiple auto-increment columns. Only one auto-increment column allowed per table.`,
                        table: tableName,
                        column: columnName,
                    });
                }
                autoincrementColumns.push(columnName);

                // Check autoincrement column must be int type
                if (column.type !== 'int') {
                    errors.push({
                        code: 'COLUMN_AUTOINCREMENT_NOT_INT',
                        message: `Column '${column.name}' in table '${table.name}' has auto-increment default but type is '${column.type}'. Auto-increment requires int type.`,
                        table: tableName,
                        column: columnName,
                    });
                }

                // Check autoincrement column must be primary key
                if (!column.primaryKey) {
                    errors.push({
                        code: 'COLUMN_AUTOINCREMENT_NOT_PK',
                        message: `Column '${column.name}' in table '${table.name}' has auto-increment default but is not a primary key. Auto-increment requires primary key.`,
                        table: tableName,
                        column: columnName,
                    });
                }
            }

            // Validate UUID default
            if (defaultKind === 'uuid') {
                // Check UUID default cannot be on int type
                if (column.type === 'int') {
                    errors.push({
                        code: 'COLUMN_UUID_ON_INT',
                        message: `Column '${column.name}' in table '${table.name}' has UUID default but type is 'int'. UUID default requires uuid or varchar type.`,
                        table: tableName,
                        column: columnName,
                    });
                }
            }

            // Validate now() default
            if (defaultKind === 'now') {
                // Check now() default can only be on timestamp type
                if (column.type !== 'timestamp') {
                    errors.push({
                        code: 'COLUMN_NOW_NOT_TIMESTAMP',
                        message: `Column '${column.name}' in table '${table.name}' has now() default but type is '${column.type}'. now() default requires timestamp type.`,
                        table: tableName,
                        column: columnName,
                    });
                }
            }

            // Validate custom value default
            if (defaultKind === 'value') {
                // Custom value defaults are always valid (no type restrictions)
                // The value itself is not validated here (could be validated in future)
            }
        }
    }
}

/**
 * Pure function that validates a normalized schema and returns validation results
 * 
 * This function checks:
 * - Table naming (snake_case, reserved keywords, uniqueness, not empty)
 * - Column naming (snake_case, uniqueness within table, not empty, has type)
 * - Primary key constraints (only one PK per table)
 * - Foreign key integrity (table exists, column exists, is PK, type matches)
 * - Structural rules (tables have columns)
 * - Default value constraints (autoincrement, UUID, now(), custom)
 * 
 * @param schema - Normalized schema to validate
 * @returns Validation result with validity status and all errors
 */
export function validateSchema(schema: NormalizedSchema): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate in order: tables, columns, foreign keys, defaults
    validateTables(schema, errors);
    validateColumns(schema, errors);
    validateForeignKeys(schema, errors);
    validateDefaults(schema, errors);

    return {
        valid: errors.length === 0,
        errors,
    };
}

