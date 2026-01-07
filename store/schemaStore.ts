import { create } from 'zustand';
import { normalizeSchema, NormalizedSchema } from '@/lib/schemaNormalizer';

export interface Column {
    id: string;
    name: string;
    type: string;
    primaryKey: boolean;
    nullable: boolean;
    unique: boolean;
    default?: {
        kind: 'autoincrement' | 'uuid' | 'now' | 'value';
        value?: string; // For 'value' kind
    };
}

export interface Table {
    id: string;
    name: string;
    columns: Column[];
}

export interface Relation {
    id: string;
    fromTableId: string;
    fromColumnId: string;
    toTableId: string;
    toColumnId: string;
}

interface SchemaStore {
    tables: Table[];
    relations: Relation[];
    isNormalized: boolean;
    addTable: () => void;
    updateTableName: (id: string, name: string) => void;
    deleteTable: (id: string) => void;
    addColumn: (tableId: string) => void;
    updateColumn: (tableId: string, columnId: string, data: Partial<Column>) => void;
    deleteColumn: (tableId: string, columnId: string) => void;
    addRelation: (relation: Omit<Relation, 'id'>) => void;
    updateRelation: (relationId: string, updates: Partial<Omit<Relation, 'id'>>) => void;
    removeRelation: (relationId: string) => void;
    getNormalizedSchema: () => NormalizedSchema;
    loadSchema: (tables: Table[], relations: Relation[]) => void;
    setNormalized: (normalized: boolean) => void;
}

export const useSchemaStore = create<SchemaStore>()((set, get) => ({
    tables: [],
    relations: [],
    isNormalized: false,

    addTable: () => {
        const newTable: Table = {
            id: crypto.randomUUID(),
            name: 'new_table',
            columns: [],
        };
        set((state) => ({
            tables: [...state.tables, newTable],
            isNormalized: false, // Reset normalization flag when schema changes
        }));
    },

    updateTableName: (id: string, name: string) => {
        set((state) => ({
            tables: state.tables.map((table) =>
                table.id === id ? { ...table, name } : table
            ),
            isNormalized: false, // Reset normalization flag when schema changes
        }));
    },

    deleteTable: (id: string) => {
        set((state) => ({
            tables: state.tables.filter((table) => table.id !== id),
            // Also remove any relations involving this table
            relations: state.relations.filter(
                (rel) => rel.fromTableId !== id && rel.toTableId !== id
            ),
            isNormalized: false, // Reset normalization flag when schema changes
        }));
    },

    addColumn: (tableId: string) => {
        const newColumn: Column = {
            id: crypto.randomUUID(),
            name: 'column_name',
            type: 'varchar',
            primaryKey: false,
            nullable: false,
            unique: false,
        };
        set((state) => ({
            tables: state.tables.map((table) =>
                table.id === tableId
                    ? { ...table, columns: [...table.columns, newColumn] }
                    : table
            ),
            isNormalized: false, // Reset normalization flag when schema changes
        }));
    },

    updateColumn: (tableId: string, columnId: string, data: Partial<Column>) => {
        set((state) => ({
            tables: state.tables.map((table) =>
                table.id === tableId
                    ? {
                        ...table,
                        columns: table.columns.map((column) =>
                            column.id === columnId ? { ...column, ...data } : column
                        ),
                    }
                    : table
            ),
            isNormalized: false, // Reset normalization flag when schema changes
        }));
    },

    deleteColumn: (tableId: string, columnId: string) => {
        set((state) => ({
            tables: state.tables.map((table) =>
                table.id === tableId
                    ? {
                        ...table,
                        columns: table.columns.filter((column) => column.id !== columnId),
                    }
                    : table
            ),
            // Also remove any relations involving this column
            relations: state.relations.filter(
                (rel) =>
                    !(rel.fromTableId === tableId && rel.fromColumnId === columnId) &&
                    !(rel.toTableId === tableId && rel.toColumnId === columnId)
            ),
            isNormalized: false, // Reset normalization flag when schema changes
        }));
    },

    addRelation: (relation: Omit<Relation, 'id'>) => {
        const newRelation: Relation = {
            id: crypto.randomUUID(),
            ...relation,
        };
        set((state) => ({
            relations: [...state.relations, newRelation],
            isNormalized: false, // Reset normalization flag when schema changes
        }));
    },

    updateRelation: (relationId: string, updates: Partial<Omit<Relation, 'id'>>) => {
        set((state) => ({
            relations: state.relations.map((rel) =>
                rel.id === relationId ? { ...rel, ...updates } : rel
            ),
            isNormalized: false, // Reset normalization flag when schema changes
        }));
    },

    removeRelation: (relationId: string) => {
        set((state) => ({
            relations: state.relations.filter((rel) => rel.id !== relationId),
            isNormalized: false, // Reset normalization flag when schema changes
        }));
    },

    getNormalizedSchema: () => {
        const state = get();
        return normalizeSchema(state.tables, state.relations);
    },

    loadSchema: (tables: Table[], relations: Relation[]) => {
        set({
            tables,
            relations,
            isNormalized: false, // Reset normalization flag when loading new schema
        });
    },
    setNormalized: (value: boolean) => {
        set({ isNormalized: value });
    },
}));
