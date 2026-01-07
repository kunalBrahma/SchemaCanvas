"use client";

import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useSchemaStore } from "@/store/schemaStore";
import { normalizeSchema } from "@/lib/schemaNormalizer";
import { validateSchema } from "@/lib/schemaValidator";
import { generatePostgresSQL } from "@/lib/sql/postgresGenerator";
import { generatePrismaSchema } from "@/lib/prisma/prismaGenerator";

export default function ExportPanel() {
  const { tables, relations, isNormalized } = useSchemaStore();

  // Check if schema is valid and normalized (for button disabled state)
  const canExport = useMemo(() => {
    if (!isNormalized) {
      return false; // Must normalize first
    }
    const normalized = normalizeSchema(tables, relations);
    const validation = validateSchema(normalized);
    return validation.valid;
  }, [tables, relations, isNormalized]);

  const copyToClipboard = useCallback(async (type: "sql" | "prisma") => {
    if (!isNormalized) {
      toast.error("Please normalize schema first", {
        description: "Click the 'Normalize' button before exporting.",
        duration: 5000,
      });
      return;
    }

    const normalized = normalizeSchema(tables, relations);
    const validation = validateSchema(normalized);

    if (!validation.valid) {
      const firstError = validation.errors[0];
      toast.error("Schema has errors. Fix before exporting.", {
        description: firstError?.message || "Please fix validation errors first.",
        duration: 5000,
      });
      return;
    }

    const output =
      type === "sql"
        ? generatePostgresSQL(normalized)
        : generatePrismaSchema(normalized);

    try {
      await navigator.clipboard.writeText(output);
      toast.success("Copied to clipboard!", {
        duration: 2000,
      });
    } catch {
      toast.error("Failed to copy to clipboard", {
        description: "Please try again or copy manually.",
        duration: 3000,
      });
    }
  }, [tables, relations, isNormalized]);

  const valid = canExport;

  return (
    <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
      <button
        onClick={() => copyToClipboard("sql")}
        disabled={!valid}
        className={`group px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 font-medium flex items-center gap-2 ${valid
            ? "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
            : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-gray-200 dark:border-gray-700 opacity-50"
          }`}
        title={valid ? "Copy PostgreSQL SQL to clipboard" : isNormalized ? "Fix schema errors before exporting" : "Normalize schema first"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 ${valid ? "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" : "text-gray-400 dark:text-gray-600"} transition-colors`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
          <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
        </svg>
        <span className="text-sm">Copy PostgreSQL</span>
      </button>
      <button
        onClick={() => copyToClipboard("prisma")}
        disabled={!valid}
        className={`group px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 font-medium flex items-center gap-2 ${valid
            ? "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
            : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-gray-200 dark:border-gray-700 opacity-50"
          }`}
        title={valid ? "Copy Prisma schema to clipboard" : isNormalized ? "Fix schema errors before exporting" : "Normalize schema first"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 ${valid ? "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" : "text-gray-400 dark:text-gray-600"} transition-colors`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
          <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
        </svg>
        <span className="text-sm">Copy Prisma</span>
      </button>
    </div>
  );
}

