# Implementation Plan - Inventory Management System

## ✅ Phase 1: Models (COMPLETED)

### Models Created:
- ✅ Product (with image, cases/bottles support)
- ✅ Customer
- ✅ WorkerStock
- ✅ Order
- ✅ OrderItem
- ✅ Sale
- ✅ SaleItem
- ✅ Payment
- ✅ StockTransaction

### Features:
- ✅ Custom ID system (nanoid)
- ✅ TypeScript interfaces
- ✅ Cases + Bottles handling
- ✅ Virtual fields for display
- ✅ Proper indexing
- ✅ All references using String IDs

---

## 🎯 Phase 2: Routes & Controllers (PENDING)

### Order of Implementation:

#### 1️⃣ Product Routes (Start Here)
**Why First?** Products are foundation - needed for everything else

**Routes to Create:**
```
POST   /api/products              - Create product (ADMIN only)
GET    /api/products              - List all products (PUBLIC or orgId filtered)
GET    /api/products/:id          - Get single product (PUBLIC or orgId filtered)
PUT    /api/products/:id          - Update product (ADMIN only)
DELETE /api/products/:id          - Soft delete product (ADMIN only)
GET    /api/products/low-stock    - Get low stock products (ADMIN/WORKER)
```

**Auth & Authorization:**
| Route | Auth | Role | Notes |
|-------|------|------|-------|
| POST /products | ✅ Required | ADMIN | Only admin can create |
| GET /products | ✅ Required | ALL | Filter by user's orgId |
| GET /products/:id | ✅ Required | ALL | Check orgId match |
| PUT /products/:id | ✅ Required | ADMIN | Check orgId match |
| DELETE /products/:id | ✅ Required | ADMIN | Check orgId match |
| GET /products/low-stock | ✅ Required | ADMIN, WORKER | Filter by orgId |

**What We Need:**
- [ ] Product routes file
- [ ] Zod validation schemas
- [ ] OrgId filtering logic
- [ ] Low stock calculation

---

#### 2️⃣ Customer Routes
**Why Second?** Need customers before creating orders/sales

**Routes to Create:**
```
POST   /api/customers             - Create customer (ADMIN/WORKER)
GET    /api/customers             - List all customers (ADMIN/WORKER)
GET    /api/customers/:id         - Get single customer (ADMIN/WORKER)
PUT    /api/customers/:id         - Update customer (ADMIN/WORKER)
DELETE /api/customers/:id         - Soft delete customer (ADMIN only)
GET    /api/customers/search      - Search by name/phone (ADMIN/WORKER)
```

**Auth & Authorization:**
| Route | Auth | Role | Notes |
|-------|------|------|-------|
| POST /customers | ✅ Required | ADMIN, WORKER | Create with user's orgId |
| GET /customers | ✅ Required | ADMIN, WORKER | Filter by orgId |
| GET /customers/:id | ✅ Required | ADMIN, WORKER | Check orgId match |
| PUT /customers/:id | ✅ Required | ADMIN, WORKER | Check orgId match |
| DELETE /customers/:id | ✅ Required | ADMIN | Check orgId match |
| GET /customers/search | ✅ Required | ADMIN, WORKER | Filter by orgId |

**What We Need:**
- [ ] Customer routes file
- [ ] Zod validation schemas
- [ ] Search functionality (regex)
- [ ] OrgId filtering

---

#### 3️⃣ Stock Management Routes
**Why Third?** Need to add stock to warehouse before issuing to workers

**Routes to Create:**
```
POST   /api/stock/purchase        - Purchase stock (ADMIN only)
POST   /api/stock/issue           - Issue stock to worker (ADMIN only)
POST   /api/stock/return          - Return stock from worker (ADMIN/WORKER)
POST   /api/stock/adjustment      - Manual stock adjustment (ADMIN only)
GET    /api/stock/transactions    - Get stock transaction history (ADMIN/WORKER)
GET    /api/stock/warehouse       - Get warehouse stock (ADMIN)
```

**Auth & Authorization:**
| Route | Auth | Role | Notes |
|-------|------|------|-------|
| POST /stock/purchase | ✅ Required | ADMIN | Add stock to Product |
| POST /stock/issue | ✅ Required | ADMIN | Transfer to WorkerStock |
| POST /stock/return | ✅ Required | ADMIN, WORKER | Worker can return own stock |
| POST /stock/adjustment | ✅ Required | ADMIN | Manual corrections |
| GET /stock/transactions | ✅ Required | ADMIN, WORKER | Worker sees own transactions |
| GET /stock/warehouse | ✅ Required | ADMIN | All products stock |

**What We Need:**
- [ ] Stock routes file
- [ ] Zod validation schemas
- [ ] Stock transaction logic
- [ ] Negative stock prevention
- [ ] Cases + Bottles conversion

---

#### 4️⃣ Worker Stock Routes
**Why Fourth?** See what workers have before taking orders

**Routes to Create:**
```
GET    /api/worker-stock/:workerId           - Get worker's stock (ADMIN/Own WORKER)
GET    /api/worker-stock/:workerId/:productId - Get specific product stock (ADMIN/Own WORKER)
GET    /api/worker-stock/all                  - Get all workers' stock (ADMIN only)
```

**Auth & Authorization:**
| Route | Auth | Role | Notes |
|-------|------|------|-------|
| GET /worker-stock/:workerId | ✅ Required | ADMIN, Own WORKER | Worker can see only own stock |
| GET /worker-stock/:workerId/:productId | ✅ Required | ADMIN, Own WORKER | Check workerId = user.id |
| GET /worker-stock/all | ✅ Required | ADMIN | All workers overview |

**What We Need:**
- [ ] WorkerStock routes file
- [ ] Worker ownership check
- [ ] Cases + Bottles display
- [ ] Stock aggregation

---

#### 5️⃣ Order Routes (Market Orders)
**Why Fifth?** Workers collect orders from market

**Routes to Create:**
```
POST   /api/orders                - Create order (WORKER collects)
GET    /api/orders                - List all orders (ADMIN/WORKER)
GET    /api/orders/:id            - Get order details (ADMIN/Own WORKER)
PUT    /api/orders/:id            - Update order (ADMIN/Own WORKER)
PATCH  /api/orders/:id/status     - Update order status (ADMIN/Own WORKER)
DELETE /api/orders/:id            - Cancel order (ADMIN/Own WORKER)
GET    /api/orders/pending        - Get pending orders (ADMIN/WORKER)
GET    /api/orders/worker/:id     - Get worker's orders (ADMIN/Own WORKER)
POST   /api/orders/:id/deliver    - Mark delivered & create sale (Own WORKER)
```

**Auth & Authorization:**
| Route | Auth | Role | Notes |
|-------|------|------|-------|
| POST /orders | ✅ Required | WORKER | Create with workerId = user.id |
| GET /orders | ✅ Required | ADMIN, WORKER | Worker sees own orders |
| GET /orders/:id | ✅ Required | ADMIN, Own WORKER | Check workerId match |
| PUT /orders/:id | ✅ Required | ADMIN, Own WORKER | Check workerId match |
| PATCH /orders/:id/status | ✅ Required | ADMIN, Own WORKER | Update status |
| DELETE /orders/:id | ✅ Required | ADMIN, Own WORKER | Cancel order |
| GET /orders/pending | ✅ Required | ADMIN, WORKER | Filter by workerId |
| GET /orders/worker/:id | ✅ Required | ADMIN, Own WORKER | Check workerId |
| POST /orders/:id/deliver | ✅ Required | WORKER | Check workerId, create Sale |

**What We Need:**
- [ ] Order routes file
- [ ] Zod validation schemas
- [ ] Partial delivery logic
- [ ] Auto-create sale on delivery
- [ ] Stock deduction

---

#### 6️⃣ Sale Routes (Billing)
**Why Sixth?** Generate bills after delivery

**Routes to Create:**
```
POST   /api/sales                 - Create sale (WORKER - direct or from order)
GET    /api/sales                 - List all sales (ADMIN/WORKER)
GET    /api/sales/:id             - Get sale details with items (ADMIN/Own WORKER)
PUT    /api/sales/:id             - Update sale (ADMIN only)
DELETE /api/sales/:id             - Cancel sale (ADMIN only)
GET    /api/sales/invoice/:invoiceNo - Get by invoice number (ADMIN/WORKER)
GET    /api/sales/pending-payment    - Get sales with pending payment (ADMIN/WORKER)
GET    /api/sales/worker/:id         - Get worker's sales (ADMIN/Own WORKER)
```

**Auth & Authorization:**
| Route | Auth | Role | Notes |
|-------|------|------|-------|
| POST /sales | ✅ Required | WORKER | Create with workerId = user.id |
| GET /sales | ✅ Required | ADMIN, WORKER | Worker sees own sales |
| GET /sales/:id | ✅ Required | ADMIN, Own WORKER | Check workerId match |
| PUT /sales/:id | ✅ Required | ADMIN | Full update admin only |
| DELETE /sales/:id | ✅ Required | ADMIN | Cancel sale |
| GET /sales/invoice/:invoiceNo | ✅ Required | ADMIN, WORKER | Filter by orgId |
| GET /sales/pending-payment | ✅ Required | ADMIN, WORKER | Worker sees own |
| GET /sales/worker/:id | ✅ Required | ADMIN, Own WORKER | Check workerId |

**What We Need:**
- [ ] Sale routes file
- [ ] Zod validation schemas
- [ ] Invoice generation
- [ ] Worker stock deduction
- [ ] Order linking (optional)

---

#### 7️⃣ Payment Routes
**Why Seventh?** Collect payments for sales

**Routes to Create:**
```
POST   /api/payments              - Add payment to sale (WORKER)
GET    /api/payments/sale/:id     - Get payments for a sale (ADMIN/Own WORKER)
GET    /api/payments              - List all payments (ADMIN)
GET    /api/payments/pending      - Get pending payments summary (ADMIN/WORKER)
```

**Auth & Authorization:**
| Route | Auth | Role | Notes |
|-------|------|------|-------|
| POST /payments | ✅ Required | WORKER | Check sale workerId match |
| GET /payments/sale/:id | ✅ Required | ADMIN, Own WORKER | Check sale workerId |
| GET /payments | ✅ Required | ADMIN | All payments |
| GET /payments/pending | ✅ Required | ADMIN, WORKER | Worker sees own |

**What We Need:**
- [ ] Payment routes file
- [ ] Zod validation schemas
- [ ] Auto-update sale payment status
- [ ] Payment validation
- [ ] Worker ownership check

---

#### 8️⃣ Reports & Analytics (Optional)
**Why Last?** All data available, now analyze it

**Routes to Create:**
```
GET    /api/reports/sales-summary         - Daily/monthly sales (ADMIN)
GET    /api/reports/worker-performance    - Worker sales stats (ADMIN)
GET    /api/reports/product-sales         - Product-wise sales (ADMIN)
GET    /api/reports/pending-payments      - Payment collection report (ADMIN/WORKER)
GET    /api/reports/stock-summary         - Stock status report (ADMIN)
```

**Auth & Authorization:**
| Route | Auth | Role | Notes |
|-------|------|------|-------|
| GET /reports/sales-summary | ✅ Required | ADMIN | Aggregation queries |
| GET /reports/worker-performance | ✅ Required | ADMIN | All workers stats |
| GET /reports/product-sales | ✅ Required | ADMIN | Product analytics |
| GET /reports/pending-payments | ✅ Required | ADMIN, WORKER | Worker sees own |
| GET /reports/stock-summary | ✅ Required | ADMIN | Inventory overview |

**What We Need:**
- [ ] Reports routes file
- [ ] Aggregation queries
- [ ] Date range filters
- [ ] Export functionality (CSV/PDF)

---

## 🛠️ Technical Requirements (For All Routes)

### Available Middleware:
```typescript
// Authentication
requireAuth              // Checks valid session, attaches user to context

// Authorization (Role-based)
requireRole(...roles)    // Allows specific roles: ADMIN, USER, WORKER
requireAdmin             // Admin only (shortcut)

// Roles Available
UserRole.ADMIN   = "admin"
UserRole.USER    = "user"
UserRole.WORKER  = "worker"
```

### Helper Functions:
```typescript
isAdmin(user)                          // Check if admin
isOwner(user, resourceUserId)         // Check if owner
canAccessResource(user, resourceUserId) // Admin or owner
```

### Validation Strategy (Zod):
```typescript
// schemas/product.schema.ts
import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().optional(),
  packSize: z.string().min(1, "Pack size is required"),
  unit: z.enum(["BOTTLE", "PIECE", "KG", "LITER", "PACKET"]).default("BOTTLE"),
  unitsPerCase: z.number().int().min(1, "Units per case must be at least 1"),
  purchaseRate: z.number().min(0, "Purchase rate must be positive"),
  sellingRate: z.number().min(0, "Selling rate must be positive"),
  minimumStock: z.number().int().min(0).default(0),
  gstRate: z.number().min(0).max(100).default(0),
  image: z.string().url().optional(),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const productParamsSchema = z.object({
  id: z.string().min(1, "Product ID is required"),
});
```

### Error Handling (Hono.js):
```typescript
import { HTTPException } from "hono/http-exception";

// Usage
throw new HTTPException(404, { message: "Product not found" });
throw new HTTPException(400, { message: "Invalid input" });
throw new HTTPException(403, { message: "Forbidden" });
```

### Response Format (Hono.js):
```typescript
// Success - Single item
return c.json(product, 201);

// Success - List with pagination
return c.json({
  data: products,
  pagination: {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  },
});

// Error (automatically handled by HTTPException)
throw new HTTPException(404, { message: "Product not found" });
```

---

## 📂 Suggested Folder Structure (Hono.js Style)

```
server/src/
├── models/              ✅ DONE
│   ├── Product.ts
│   ├── Customer.ts
│   ├── Order.ts
│   ├── Sale.ts
│   └── ...
│
├── routes/              ⏳ TO DO (Routes + Handlers together)
│   ├── product.routes.ts
│   ├── customer.routes.ts
│   ├── order.routes.ts
│   ├── sale.routes.ts
│   ├── stock.routes.ts
│   ├── payment.routes.ts
│   └── index.ts
│
├── schemas/             ⏳ TO DO (Zod validation schemas)
│   ├── product.schema.ts
│   ├── customer.schema.ts
│   ├── order.schema.ts
│   ├── sale.schema.ts
│   └── ...
│
├── middleware/          ⏳ TO DO
│   ├── authentication.middleware.ts
│   ├── authorization.middleware.ts
│   └── ...
│
├── utils/               ✅ DONE (stockHelpers)
│   ├── stockHelpers.ts
│   └── ...
│
└── index.ts             ⏳ TO DO (Hono app setup)
```

---

## 🚀 Next Steps - Start Implementation

### Step 1: Setup Express App (Foundation)
- [ ] Create `server/src/index.ts`
- [ ] Setup Express
- [ ] Connect to MongoDB
- [ ] Setup middleware (cors, body-parser, etc.)
- [ ] Error handling setup

### Step 2: Create Product Routes (First Feature)
- [ ] Create validation schema
- [ ] Create controller
- [ ] Create routes
- [ ] Test with Postman/Thunder Client

### Step 3: Continue with Other Routes
Follow the order mentioned above (Customer → Stock → WorkerStock → Order → Sale → Payment)

---

## 💡 Implementation Tips

1. **Start Small**: Implement one route at a time, test it, then move next
2. **Use Thunder Client**: Test each endpoint as you build
3. **Error Handling**: Handle all edge cases
4. **Validation**: Validate all inputs before processing
5. **Stock Management**: Always check stock before operations
6. **Transaction Support**: Use MongoDB transactions for critical operations (stock updates)

---

## 🎯 Current Status

```
Phase 1: Models          ✅ 100% Complete
Phase 2: Routes          ⏳ 0% Complete
Phase 3: Testing         ⏳ 0% Complete
Phase 4: Deployment      ⏳ 0% Complete
```

---

## 📝 Notes

- All models use custom nanoid IDs
- Cases + Bottles supported everywhere
- Virtual fields for display
- TypeScript interfaces available
- Payment model separate (multiple payments per sale)
- Order model supports partial delivery
- Stock tracked in individual units (bottles)

---

## ❓ Answered Questions:

1. ✅ Framework: **Hono.js**
2. ✅ Validation: **Zod** (with @hono/zod-validator)
3. ✅ Authentication: **Better Auth** (requireAuth, requireAdmin middleware)
4. ❓ Database connection: Already setup?
5. ✅ Error handling: **HTTPException**

---

## 🎯 Hono.js Route Structure Example

```typescript
// routes/product.routes.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { Product } from "@/models";
import { createProductSchema, productParamsSchema } from "@/schemas/product.schema";

type Variables = {
  user: User | null;
  session: Session | null;
};

const app = new Hono<{ Variables: Variables }>();

// GET /api/products
app.get("/", async (c) => {
  const products = await Product.find({ isActive: true });
  return c.json({ data: products });
});

// POST /api/products (Admin only)
app.post(
  "/",
  requireAuth,
  requireAdmin,
  zValidator("json", createProductSchema),
  async (c) => {
    const body = c.req.valid("json");
    const user = c.get("user") as User;
    
    const product = await Product.create({
      ...body,
      orgId: user.orgId, // From authenticated user
    });
    
    return c.json(product, 201);
  }
);

export default app;
```

**READY TO START? Let's begin with Product Routes!** 🚀
