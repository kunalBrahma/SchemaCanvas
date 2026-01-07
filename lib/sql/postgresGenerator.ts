import { NormalizedSchema, NormalizedColumn } from '../schemaNormalizer';
import { validateSchemaForGeneration } from '../generatorValidation';

/**
 * Maps schema types to PostgreSQL types
 */
function mapTypeToPostgres(schemaType: string): string {
    const typeMap: Record<string, string> = {
        'int': 'INT',
        'varchar': 'VARCHAR',
        'text': 'TEXT',
        'boolean': 'BOOLEAN',
        'timestamp': 'TIMESTAMP',
        'uuid': 'UUID',
    };
    return typeMap[schemaType.toLowerCase()] || schemaType.toUpperCase();
}

/**
 * Escapes and quotes a string value for SQL
 */
function escapeSQLValue(value: string): string {
    // Replace single quotes with escaped single quotes
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
}

/**
 * Generates a column definition with constraints in the correct order
 * Order: TYPE (or SERIAL for autoincrement), DEFAULT, UNIQUE, NOT NULL, PRIMARY KEY
 */
function generateColumnDefinition(column: NormalizedColumn): string {
    const parts: string[] = [column.name];

    // Handle autoincrement: use SERIAL type
    if (column.default?.kind === 'autoincrement') {
        parts.push('SERIAL');
    } else {
        // Use regular type mapping
        const postgresType = mapTypeToPostgres(column.type);
        parts.push(postgresType);
    }

    // Add DEFAULT clause if present
    if (column.default) {
        if (column.default.kind === 'uuid') {
            parts.push('DEFAULT gen_random_uuid()');
        } else if (column.default.kind === 'now') {
            parts.push('DEFAULT now()');
        } else if (column.default.kind === 'value' && column.default.value !== undefined) {
            parts.push(`DEFAULT ${escapeSQLValue(column.default.value)}`);
        }
        // autoincrement doesn't need DEFAULT clause (SERIAL handles it)
    }

    // Add constraints in order: UNIQUE, NOT NULL, PRIMARY KEY
    if (column.unique) {
        parts.push('UNIQUE');
    }
    if (!column.nullable) {
        parts.push('NOT NULL');
    }
    if (column.primaryKey) {
        parts.push('PRIMARY KEY');
    }

    return parts.join(' ');
}

/**
 * Orders tables based on foreign key dependencies using topological sort
 * Tables without FKs come first, then tables whose dependencies are already included
 */
function orderTables(schema: NormalizedSchema): string[] {
    const tables = Object.keys(schema.tables);
    const dependencies = new Map<string, Set<string>>();

    // Build dependency map: table → set of tables it depends on (via FKs)
    for (const [tableName, table] of Object.entries(schema.tables)) {
        const deps = new Set<string>();
        for (const column of Object.values(table.columns)) {
            if (column.foreignKey) {
                deps.add(column.foreignKey.table);
            }
        }
        dependencies.set(tableName, deps);
    }

    // Topological sort
    const ordered: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>(); // For cycle detection

    function visit(tableName: string): void {
        if (visiting.has(tableName)) {
            // Cycle detected - should not happen with validated schema, but handle gracefully
            return;
        }
        if (visited.has(tableName)) {
            return;
        }

        visiting.add(tableName);

        // Visit all dependencies first
        const deps = dependencies.get(tableName) || new Set();
        for (const dep of deps) {
            if (schema.tables[dep]) {
                visit(dep);
            }
        }

        visiting.delete(tableName);
        visited.add(tableName);
        ordered.push(tableName);
    }

    // Visit all tables
    for (const tableName of tables) {
        visit(tableName);
    }

    return ordered;
}

/**
 * Generates a CREATE TABLE statement for a single table
 */
function generateTableSQL(tableName: string, table: { name: string; columns: { [key: string]: NormalizedColumn } }): string {
    const lines: string[] = [];
    lines.push(`CREATE TABLE ${table.name} (`);

    const columnDefs: string[] = [];
    const fkConstraints: string[] = [];

    // Generate column definitions
    for (const column of Object.values(table.columns)) {
        columnDefs.push(`  ${generateColumnDefinition(column)}`);
    }

    // Generate foreign key constraints
    // CRITICAL: Only generate FK for non-PK columns (validation ensures this)
    for (const column of Object.values(table.columns)) {
        if (column.foreignKey && !column.primaryKey) {
            fkConstraints.push(
                `  FOREIGN KEY (${column.name}) REFERENCES ${column.foreignKey.table}(${column.foreignKey.column})`
            );
        }
    }

    // Combine columns and FKs
    const allDefinitions = [...columnDefs, ...fkConstraints];
    lines.push(allDefinitions.join(',\n'));
    lines.push(');');

    return lines.join('\n');
}

/**
 * Pure function that generates valid PostgreSQL SQL from a normalized schema
 * 
 * VALIDATION: This function performs strict validation before generation.
 * It will throw GeneratorValidationError if:
 * - FK references a non-PK column
 * - FK exists on a PK column
 * - FK target table/column does not exist
 * 
 * The function:
 * - Orders tables correctly (dependency-based topological sort)
 * - Maps schema types to PostgreSQL types
 * - Generates column constraints in correct order
 * - Generates foreign key constraints ONLY for non-PK columns
 * - Formats output with proper indentation and spacing
 * 
 * @param schema - Normalized schema (will be validated)
 * @returns PostgreSQL SQL string ready to execute
 * @throws GeneratorValidationError if schema validation fails
 */
export function generatePostgresSQL(schema: NormalizedSchema): string {
    // FAIL FAST: Validate schema before generation
    validateSchemaForGeneration(schema);

    const orderedTables = orderTables(schema);
    const statements: string[] = [];

    for (const tableName of orderedTables) {
        const table = schema.tables[tableName];
        if (table) {
            statements.push(generateTableSQL(tableName, table));
        }
    }

    // Join with blank lines between tables
    return statements.join('\n\n');
}

