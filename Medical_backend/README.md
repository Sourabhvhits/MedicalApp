# Backend — Medical Marketplace API

Express + TypeScript + Prisma + MySQL. See the [root README](../README.md) for the
full picture and [`docs/`](../docs) for architecture, API and operations.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with reload on `:5000` |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end HTTP tests against a running API |
| `npm run prisma:migrate` | Create a migration (development) |
| `npm run prisma:deploy` | Apply migrations (production) |
| `npm run prisma:studio` | Browse the database |
| `npm run seed` | Permissions, roles, super admin, masters, 20 products |
| `npm run seed:demo` | Demo vendor, two shops, a customer, catalogues and stock |
| `npm run db:sql` | Write the full schema DDL to `prisma/generated-schema.sql` |

## Module layout

Each module under `src/modules/` follows the same shape:

```
<module>/
├── <module>.validation.ts   zod schemas — the only place input shapes are defined
├── <module>.service.ts      business rules and transactions
├── <module>.controller.ts   request/response shaping (thin; some modules inline it)
└── <module>.routes.ts       routing, RBAC, audit and OpenAPI registration
```

Controllers never contain business logic, and only services open transactions.

## Things worth knowing before you change stock code

- `modules/inventory/inventory.service.ts` is the only module that writes stock.
  Everything else calls into it so that an `inventory_transactions` row is always
  produced.
- `allocateFefo` uses `SELECT … FOR UPDATE`. It must be called inside a
  transaction, and the transaction should stay short.
- `utils/tax.ts` is the only place GST is calculated. Do not inline tax maths.
- Money is `Prisma.Decimal` end to end. Use the helpers in `utils/money.ts`;
  never do float arithmetic on amounts.
