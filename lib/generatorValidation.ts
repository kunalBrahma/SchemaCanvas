import { NormalizedSchema, NormalizedColumn } from './schemaNormalizer';

/**
 * Validation error for generator operations
 */
export class GeneratorValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GeneratorValidationError';
    }
}

/**
 * Validates that all foreign keys in the schema follow the correct rules:
 * 1. FK metadata exists ONLY on non-PK columns
 * 2. FK metadata ALWAYS references a PK column
 * 3. FK target table and column exist
 * 
 * @throws GeneratorValidationError if validation fails
 */
export function validateForeignKeys(schema: NormalizedSchema): void {
    const errors: string[] = [];

    // Build a map of all PK columns for validation
    const pkColumns = new Map<string, Set<string>>();
    for (const [tableName, table] of Object.entries(schema.tables)) {
        const pks = new Set<string>();
        for (const [columnName, column] of Object.entries(table.columns)) {
            if (column.primaryKey) {
                pks.add(columnName);
            }
        }
        pkColumns.set(tableName, pks);
    }

    // Validate all FK constraints
    for (const [tableName, table] of Object.entries(schema.tables)) {
        for (const [columnName, column] of Object.entries(table.columns)) {
            // Check #1: FK metadata should NOT be on PK columns
            if (column.foreignKey && column.primaryKey) {
                errors.push(
                    `CRITICAL: Column '${columnName}' in table '${tableName}' is marked as PRIMARY KEY but has foreignKey metadata. ` +
                    `Foreign keys can only exist on non-primary key columns.`
                );
            }

            // Check #2 & #3: If FK exists, validate the target
            if (column.foreignKey) {
                const { table: refTable, column: refColumn } = column.foreignKey;

                // Check if target table exists
                if (!schema.tables[refTable]) {
                    errors.push(
                        `FK ERROR: Column '${columnName}' in table '${tableName}' references non-existent table '${refTable}'`
                    );
                    continue;
                }

                // Check if target column exists
                const targetColumns = schema.tables[refTable].columns;
                if (!targetColumns[refColumn]) {
                    errors.push(
                        `FK ERROR: Column '${columnName}' in table '${tableName}' references non-existent column '${refColumn}' in table '${refTable}'`
                    );
                    continue;
                }

                // Check if target column is a PRIMARY KEY
                const refPks = pkColumns.get(refTable);
                if (!refPks || !refPks.has(refColumn)) {
                    errors.push(
                        `FK ERROR: Column '${columnName}' in table '${tableName}' references column '${refColumn}' in table '${refTable}', ` +
                        `but '${refColumn}' is NOT a primary key. Foreign keys must reference primary key columns.`
                    );
                }
            }
        }
    }

    if (errors.length > 0) {
        throw new GeneratorValidationError(
            `Schema validation failed with ${errors.length} error(s):\n\n` +
            errors.map((err, i) => `${i + 1}. ${err}`).join('\n')
        );
    }
}

/**
 * Validates the entire schema before generation
 * 
 * @throws GeneratorValidationError if validation fails
 */
export function validateSchemaForGeneration(schema: NormalizedSchema): void {
    // Validate FK constraints
    validateForeignKeys(schema);

    // Add more validations here as needed
}
