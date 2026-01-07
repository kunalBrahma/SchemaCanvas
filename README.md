# SchemaCanvas

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![React Flow](https://img.shields.io/badge/React%20Flow-12-blue)](https://reactflow.dev/)


**A visual, validation-first database schema designer for PostgreSQL & Prisma.**

SchemaCanvas is a developer-focused tool for designing relational database schemas with an intuitive drag-and-drop interface. Unlike generic diagramming tools, SchemaCanvas enforces strict validation rules to ensure that the output—whether PostgreSQL SQL or Prisma schema—is always syntactically correct and follow architectural best practices.

![SchemaCanvas Screenshot 1](./public/screencapture1.png)
![SchemaCanvas Screenshot 2](./public/screencapture2.png)


## Why SchemaCanvas Exists

Drawing database schemas manually or in generic design tools is error-prone. Many visual designers focus on aesthetics but allow for invalid configurations (like foreign keys pointing to non-primary keys) that result in failed migrations or broken ORM definitions.

SchemaCanvas was built to solve these problems by prioritizing:
- **Correctness Over Content**: The tool validates your relationships in real-time.
- **Determinism**: The generated code is predictable and follows standardized naming conventions.
- **Fail-Fast Generation**: If a schema is invalid, the generator refuses to produce output until the errors are resolved.

## Features

- **Visual Canvas-Based Design**: Drag, connect, and organize tables using an interface powered by React Flow.
- **Comprehensive Column Management**: Define types, primary keys, nullability, unique constraints, and default values (autoincrement, UUID, now()).
- **Strict Relationship Validation**: Real-time checking of PK/FK rules to prevent invalid database designs.
- **PostgreSQL SQL Generation**: Instant generation of clean, standard-compliant SQL including indices and constraints.
- **Prisma Schema Generation**: Validated Prisma models with correct relation mappings (`@relation`).
- **Join Table Support**: Pattern-matching for join tables to handle many-to-many relationships correctly.
- **Open-Source & Extensible**: A clean, modular codebase designed for developers to extend.

## What This Project Is NOT

To build trust and set clear expectations, it is important to clarify what SchemaCanvas is not:
- **Not an AI Schema Generator**: Outputs are deterministic and based on your explicit design, not LLM guesses.
- **Not a Migration Tool**: We generate the schema code; you choose the migration runner (e.g., Prisma Migrate, Flyway, or manual application).
- **Not a Database GUI**: This is a designer, not a management tool like DBeaver or pgAdmin.
- **Not Tied to a Specific ORM Internally**: While it generates Prisma code, the core engine is DB-agnostic and focused on SQL-first principles.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Visuals**: [React Flow](https://reactflow.dev/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database (Project Storage)**: [PostgreSQL](https://www.postgresql.org/) with [Prisma](https://www.prisma.io/)

## Architecture Philosophy

SchemaCanvas follows a **DB-first schema model**. The internal state represents the database reality, which then gets normalized and fed into specific generators.

1. **Validation Before Generation**: Code generation is a pure function of a *valid* internal state.
2. **Restrictive by Design**: We explicitly disallow certain patterns, such as placing foreign keys on primary keys, to encourage cleaner normalized designs.
3. **Fail-Fast**: Generators will refuse to execute if the validator detects any critical issues.

## Getting Started

### Prerequisites
- Node.js (Latest LTS recommended)
- A PostgreSQL instance (for project storage)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kunalBrahma/SchemaCanvas.git
   cd SchemaCanvas
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   Create a `.env` file with your database connection:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5403/schemacanvas"
   ```

4. Initialize the database:
   ```bash
   npx prisma generate
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to start designing.

## Schema Validation Rules

The tool enforces several rules to maintain schema integrity:
- **Primary Key Requirement**: Every table must have a primary key.
- **Relationship Integrity**: Foreign keys must reference the primary key of the target table.
- **Unique Naming**: Table and column names must be unique within their respective scopes.
- **Snake_case Enforced**: To ensure compatibility across various SQL dialects and Prisma formatting, `snake_case` is encouraged/enforced for database identifiers.

## Roadmap

- [ ] Support for more SQL dialects (MySQL, SQLite).
- [ ] Schema templates (e.g., Auth, E-commerce, CMS).
- [ ] Collaborative editing features.
- [ ] Optional AI assistance for initial drafting (human-in-the-loop).

## Contributing

We welcome contributions from the community!
- **Issues**: Report bugs or suggest features via GitHub Issues.
- **Pull Requests**: Submit improvements directly. Please ensure your code passes linting and build checks.
- **Discussions**: Start a conversation about best practices or architectural changes.

## License

This project is licensed under the [MIT License](LICENSE).
