import { NormalizedSchema, NormalizedColumn } from '../schemaNormalizer';
import { validateSchemaForGeneration } from '../generatorValidation';

/**
 * Converts snake_case to PascalCase
 * Example: user_profiles → UserProfiles
 */
function toPascalCase(name: string): string {
    return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

/**
 * Converts snake_case to camelCase
 * Example: user_id → userId
 */
function toCamelCase(name: string): string {
    const pascal = toPascalCase(name);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Converts plural to singular using common English patterns
 * Handles: -ies → -y, -ves → -f, -ses → -s, -s → (remove s)
 * Examples:
 *   categories → category
 *   shelves → shelf
 *   boxes → box
 *   users → user
 *   media → media (unchanged)
 */
function toSingular(name: string): string {
    if (name.length <= 1) {
        return name;
    }

    // Words ending in -ies (categories → category)
    if (name.endsWith('ies')) {
        return name.slice(0, -3) + 'y';
    }

    // Words ending in -ves (shelves → shelf, knives → knife)
    if (name.endsWith('ves')) {
        return name.slice(0, -3) + 'f';
    }

    // Words ending in -ses (boxes → box, addresses → address)
    if (name.endsWith('ses')) {
        return name.slice(0, -2);
    }

    // Words ending in -xes (taxes → tax)
    if (name.endsWith('xes')) {
        return name.slice(0, -2);
    }

    // Words ending in -ches (branches → branch)
    if (name.endsWith('ches')) {
        return name.slice(0, -2);
    }

    // Words ending in -shes (dishes → dish)
    if (name.endsWith('shes')) {
        return name.slice(0, -2);
    }

    // Words ending in just -s (users → user, orders → order)
    if (name.endsWith('s')) {
        return name.slice(0, -1);
    }

    return name;
}

/**
 * Converts table name to Prisma model name (PascalCase singular)
 * CRITICAL: Singularize BEFORE PascalCase to preserve correct English spelling
 * Examples:
 *   users → user → User
 *   categories → category → Category (NOT Categorie!)
 *   order_items → order_item → OrderItem
 */
function toModelName(tableName: string): string {
    // Split by underscore, singularize each word, then PascalCase
    const words = tableName.split('_');
    const singularWords = words.map(word => toSingular(word));
    const singularTableName = singularWords.join('_');
    return toPascalCase(singularTableName);
}

/**
 * Converts table name to relation field name (camelCase singular)
 * Example: users → user, orders → order
 */
function toRelationName(tableName: string): string {
    const singular = toSingular(tableName);
    return toCamelCase(singular);
}

/**
 * Converts table name to back-relation field name (camelCase plural)
 * Example: orders → orders, user_profiles → userProfiles
 */
function toBackRelationName(tableName: string): string {
    return toCamelCase(tableName);
}

/**
 * Maps schema types to Prisma types
 */
function mapTypeToPrisma(schemaType: string): string {
    const typeMap: Record<string, string> = {
        'int': 'Int',
        'varchar': 'String',
        'text': 'String',
        'boolean': 'Boolean',
        'timestamp': 'DateTime',
        'uuid': 'String', // UUID in Prisma is typically String with @default(uuid())
    };
    return typeMap[schemaType.toLowerCase()] || schemaType;
}

/**
 * Escapes and quotes a string value for Prisma
 */
function escapePrismaValue(value: string): string {
    // Replace double quotes with escaped double quotes
    const escaped = value.replace(/"/g, '\\"');
    return `"${escaped}"`;
}

/**
 * Generates a scalar field definition
 */
function generateScalarField(column: NormalizedColumn): string {
    const fieldName = toCamelCase(column.name);
    const prismaType = mapTypeToPrisma(column.type);
    const nullable = column.nullable ? '?' : '';
    const parts: string[] = [fieldName, `${prismaType}${nullable}`];

    // Add @map if field name differs from column name
    if (fieldName !== column.name) {
        parts.push(`@map("${column.name}")`);
    }

    if (column.primaryKey) {
        parts.push('@id');
    }
    if (column.unique) {
        parts.push('@unique');
    }

    // Add default directives
    if (column.default) {
        if (column.default.kind === 'autoincrement') {
            parts.push('@default(autoincrement())');
        } else if (column.default.kind === 'uuid') {
            parts.push('@default(uuid())');
        } else if (column.default.kind === 'now') {
            parts.push('@default(now())');
        } else if (column.default.kind === 'value' && column.default.value !== undefined) {
            parts.push(`@default(${escapePrismaValue(column.default.value)})`);
        }
    }

    return parts.join(' ');
}

/**
 * Generates a relation field definition
 */
function generateRelationField(
    column: NormalizedColumn,
    referencedTableName: string,
    referencedColumnName: string
): string {
    const fieldName = toRelationName(referencedTableName);
    const modelName = toModelName(referencedTableName);
    const scalarFieldName = toCamelCase(column.name);
    const referencedFieldName = toCamelCase(referencedColumnName);

    return `${fieldName} ${modelName} @relation(fields: [${scalarFieldName}], references: [${referencedFieldName}])`;
}

/**
 * Generates a back-relation field definition
 */
function generateBackRelationField(tableName: string, modelName: string): string {
    const fieldName = toBackRelationName(tableName);
    return `${fieldName} ${modelName}[]`;
}

/**
 * Builds a map of which tables reference each table (for back-relations)
 */
function buildRelationMap(schema: NormalizedSchema): Map<string, string[]> {
    const relationMap = new Map<string, string[]>();

    for (const [tableName, table] of Object.entries(schema.tables)) {
        for (const column of Object.values(table.columns)) {
            if (column.foreignKey) {
                const referencedTable = column.foreignKey.table;
                if (!relationMap.has(referencedTable)) {
                    relationMap.set(referencedTable, []);
                }
                const referencingTables = relationMap.get(referencedTable)!;
                if (!referencingTables.includes(tableName)) {
                    referencingTables.push(tableName);
                }
            }
        }
    }

    return relationMap;
}

/**
 * Generates a Prisma model definition
 */
function generateModel(
    tableName: string,
    table: { name: string; columns: { [key: string]: NormalizedColumn } },
    relationMap: Map<string, string[]>
): string {
    const modelName = toModelName(tableName);
    const lines: string[] = [`model ${modelName} {`];

    const scalarFields: string[] = [];
    const relationFields: string[] = [];
    const backRelations: string[] = [];

    // Generate scalar fields and relation fields
    for (const column of Object.values(table.columns)) {
        // Always generate scalar field
        scalarFields.push(`  ${generateScalarField(column)}`);

        // If FK, also generate relation field
        if (column.foreignKey) {
            relationFields.push(
                `  ${generateRelationField(column, column.foreignKey.table, column.foreignKey.column)}`
            );
        }
    }

    // Generate back-relations
    const referencingTables = relationMap.get(tableName) || [];
    for (const refTableName of referencingTables) {
        const refModelName = toModelName(refTableName);
        backRelations.push(`  ${generateBackRelationField(refTableName, refModelName)}`);
    }

    // Combine all fields in order: scalars, relations, back-relations
    const allFields = [...scalarFields, ...relationFields, ...backRelations];
    lines.push(...allFields);

    // Add table mapping to preserve database table name
    lines.push(`  @@map("${tableName}")`);
    lines.push('}');

    return lines.join('\n');
}

/**
 * Pure function that generates Prisma model definitions from a normalized schema
 * 
 * VALIDATION: This function performs strict validation before generation.
 * It will throw GeneratorValidationError if:
 * - FK references a non-PK column
 * - FK exists on a PK column
 * - FK target table/column does not exist
 * 
 * The function:
 * - Converts table names to PascalCase singular model names
 * - Converts column names to camelCase field names
 * - Maps schema types to Prisma types
 * - Generates scalar fields with proper nullability, @id, @unique, and @default
 * - Generates relation fields for foreign keys (ONLY for non-PK columns)
 * - Generates back-relations for one-to-many relationships
 * - Orders models alphabetically
 * - Formats output with proper indentation
 * 
 * @param schema - Normalized schema (will be validated)
 * @returns Prisma model definitions (models section only, no datasource/generator)
 * @throws GeneratorValidationError if schema validation fails
 */
export function generatePrismaSchema(schema: NormalizedSchema): string {
    // FAIL FAST: Validate schema before generation
    validateSchemaForGeneration(schema);

    const relationMap = buildRelationMap(schema);
    const tableNames = Object.keys(schema.tables).sort(); // Alphabetical ordering

    const models: string[] = [];

    for (const tableName of tableNames) {
        const table = schema.tables[tableName];
        if (table) {
            models.push(generateModel(tableName, table, relationMap));
        }
    }

    // Join with blank lines between models
    return models.join('\n\n');
}

