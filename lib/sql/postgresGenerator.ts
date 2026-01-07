import { NormalizedSchema, NormalizedColumn } from '../schemaNormalizer';
import { validateSchemaForGeneration } from '../generatorValidation';

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

function escapeSQLValue(value: string): string {
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
}

function generateColumnDefinition(column: NormalizedColumn): string {
    const parts: string[] = [column.name];

    if (column.default?.kind === 'autoincrement') {
        parts.push('SERIAL');
    } else {
        const postgresType = mapTypeToPostgres(column.type);
        parts.push(postgresType);
    }

    if (column.default) {
        if (column.default.kind === 'uuid') {
            parts.push('DEFAULT gen_random_uuid()');
        } else if (column.default.kind === 'now') {
            parts.push('DEFAULT now()');
        } else if (column.default.kind === 'value' && column.default.value !== undefined) {
            parts.push(`DEFAULT ${escapeSQLValue(column.default.value)}`);
        }
    }

    if (column.unique) {
        parts.push('UNIQUE');
    }
    if (!column.nullable) {
        parts.push('NOT NULL');
    }

    return parts.join(' ');
}

function orderTables(schema: NormalizedSchema): string[] {
    const tables = Object.keys(schema.tables);
    const dependencies = new Map<string, Set<string>>();

    for (const [tableName, table] of Object.entries(schema.tables)) {
        const deps = new Set<string>();
        for (const column of Object.values(table.columns)) {
            if (column.foreignKey) {
                deps.add(column.foreignKey.table);
            }
        }
        dependencies.set(tableName, deps);
    }

    const ordered: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    function visit(tableName: string): void {
        if (visiting.has(tableName)) {
            return;
        }
        if (visited.has(tableName)) {
            return;
        }

        visiting.add(tableName);

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

    for (const tableName of tables) {
        visit(tableName);
    }

    return ordered;
}

function generateTableSQL(tableName: string, table: { name: string; columns: { [key: string]: NormalizedColumn } }): string {
    const lines: string[] = [];
    lines.push(`CREATE TABLE ${table.name} (`);

    const columnDefs: string[] = [];
    const fkConstraints: string[] = [];

    const pkColumns = Object.values(table.columns).filter(c => c.primaryKey);
    const isCompositePK = pkColumns.length > 1;

    for (const column of Object.values(table.columns)) {
        let def = generateColumnDefinition(column);

        if (!isCompositePK && column.primaryKey) {
            def += ' PRIMARY KEY';
        }

        columnDefs.push(`  ${def}`);
    }

    if (isCompositePK) {
        const pkNames = pkColumns.map(c => c.name).join(', ');
        columnDefs.push(`  PRIMARY KEY (${pkNames})`);
    }

    for (const column of Object.values(table.columns)) {
        if (column.foreignKey && !column.primaryKey) {
            fkConstraints.push(
                `  FOREIGN KEY (${column.name}) REFERENCES ${column.foreignKey.table}(${column.foreignKey.column})`
            );
        }
    }

    const allDefinitions = [...columnDefs, ...fkConstraints];
    lines.push(allDefinitions.join(',\n'));
    lines.push(');');

    return lines.join('\n');
}

export function generatePostgresSQL(schema: NormalizedSchema): string {
    validateSchemaForGeneration(schema);

    const orderedTables = orderTables(schema);
    const statements: string[] = [];

    for (const tableName of orderedTables) {
        const table = schema.tables[tableName];
        if (table) {
            statements.push(generateTableSQL(tableName, table));
        }
    }

    return statements.join('\n\n');
}
