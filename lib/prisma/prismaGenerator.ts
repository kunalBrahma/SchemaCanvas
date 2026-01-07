import { NormalizedSchema, NormalizedColumn } from '../schemaNormalizer';
import { validateSchemaForGeneration } from '../generatorValidation';

function toPascalCase(name: string): string {
    return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

function toCamelCase(name: string): string {
    const pascal = toPascalCase(name);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toSingular(name: string): string {
    if (name.length <= 1) {
        return name;
    }

    if (name.endsWith('ss')) {
        return name;
    }

    if (name.endsWith('ies')) {
        return name.slice(0, -3) + 'y';
    }

    if (name.endsWith('ves')) {
        return name.slice(0, -3) + 'f';
    }

    if (name.endsWith('ses')) {
        return name.slice(0, -2);
    }

    if (name.endsWith('xes')) {
        return name.slice(0, -2);
    }

    if (name.endsWith('ches')) {
        return name.slice(0, -2);
    }

    if (name.endsWith('shes')) {
        return name.slice(0, -2);
    }

    if (name.endsWith('s')) {
        return name.slice(0, -1);
    }

    return name;
}

function toModelName(tableName: string): string {
    const words = tableName.split('_');
    const singularWords = words.map(word => toSingular(word));
    const singularTableName = singularWords.join('_');
    return toPascalCase(singularTableName);
}

function toRelationName(tableName: string): string {
    const singular = toSingular(tableName);
    return toCamelCase(singular);
}

function toBackRelationName(tableName: string): string {
    return toCamelCase(tableName);
}

function mapTypeToPrisma(schemaType: string): string {
    const typeMap: Record<string, string> = {
        'int': 'Int',
        'varchar': 'String',
        'text': 'String',
        'boolean': 'Boolean',
        'timestamp': 'DateTime',
        'uuid': 'String',
    };
    return typeMap[schemaType.toLowerCase()] || schemaType;
}

function escapePrismaValue(value: string): string {
    const escaped = value.replace(/"/g, '\\"');
    return `"${escaped}"`;
}

function generateScalarField(column: NormalizedColumn, isCompositePK: boolean = false): string {
    let fieldName: string;

    if (column.foreignKey) {
        const targetModelName = toModelName(column.foreignKey.table);
        fieldName = toCamelCase(targetModelName) + 'Id';
    } else {
        fieldName = toCamelCase(column.name);
    }

    const prismaType = mapTypeToPrisma(column.type);
    const nullable = column.nullable ? '?' : '';
    const parts: string[] = [fieldName, `${prismaType}${nullable}`];

    if (fieldName !== column.name || column.foreignKey) {
        parts.push(`@map("${column.name}")`);
    }

    if (column.primaryKey && !isCompositePK) {
        parts.push('@id');
    }
    if (column.unique) {
        parts.push('@unique');
    }

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

function generateRelationField(
    column: NormalizedColumn,
    referencedTableName: string
): string {
    const fieldName = toRelationName(referencedTableName);
    const modelName = toModelName(referencedTableName);

    const scalarFieldName = toCamelCase(modelName) + 'Id';

    return `${fieldName} ${modelName} @relation(fields: [${scalarFieldName}], references: [id])`;
}

function generateBackRelationField(tableName: string, modelName: string): string {
    const fieldName = toBackRelationName(tableName);
    return `${fieldName} ${modelName}[]`;
}

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

    const pkColumns = Object.values(table.columns).filter(c => c.primaryKey);
    const isCompositePK = pkColumns.length > 1;

    for (const column of Object.values(table.columns)) {
        scalarFields.push(`  ${generateScalarField(column, isCompositePK)}`);

        if (column.foreignKey) {
            relationFields.push(
                `  ${generateRelationField(column, column.foreignKey.table)}`
            );
        }
    }

    const referencingTables = relationMap.get(tableName) || [];
    for (const refTableName of referencingTables) {
        const refModelName = toModelName(refTableName);
        backRelations.push(`  ${generateBackRelationField(refTableName, refModelName)}`);
    }

    const allFields = [...scalarFields, ...relationFields, ...backRelations];
    lines.push(...allFields);

    lines.push(`  @@map("${tableName}")`);

    if (isCompositePK) {
        const pkFieldNames = pkColumns.map(c => toCamelCase(c.name)).join(', ');
        lines.push(`  @@id([${pkFieldNames}])`);
    }

    lines.push('}');

    return lines.join('\n');
}

export function generatePrismaSchema(schema: NormalizedSchema): string {
    validateSchemaForGeneration(schema);

    const relationMap = buildRelationMap(schema);
    const tableNames = Object.keys(schema.tables).sort();

    const models: string[] = [];

    for (const tableName of tableNames) {
        const table = schema.tables[tableName];
        if (table) {
            models.push(generateModel(tableName, table, relationMap));
        }
    }

    return models.join('\n\n');
}
