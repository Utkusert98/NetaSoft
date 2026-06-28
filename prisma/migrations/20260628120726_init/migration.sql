-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('PURCHASE', 'SALE', 'RETURN');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'RETURN', 'ADJUST', 'WASTE');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('PDF', 'EXCEL', 'CSV');

-- CreateEnum
CREATE TYPE "ImportModule" AS ENUM ('TRANSACTIONS', 'INVOICES', 'PRODUCTS', 'SUPPLIERS');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'REVIEW', 'APPROVED', 'REJECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "FixedExpenseType" AS ENUM ('INVOICE', 'ACCOUNTING', 'TAX', 'RENT', 'OTHER');

-- CreateEnum
CREATE TYPE "SgkInvoiceType" AS ENUM ('GROUP_A', 'GROUP_B', 'GROUP_C', 'SEQ_MOR_TURUNCU', 'SEQ_ISYERI', 'SEQ_DIYALIZ', 'SEQ_ORGAN_NAKLI', 'SEQ_ONKOLOJI', 'SEQ_PSIKIYATRI', 'SEQ_YASLI_BAKIM', 'SEQ_PALYATIF', 'SEQ_EVDE_SAGLIK', 'SEQ_FIZIK_TEDAVI', 'SEQ_YOL_GIDERI');

-- CreateEnum
CREATE TYPE "PlatformIncomeStatus" AS ENUM ('PENDING', 'RECEIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "pharmacist_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tax_number" TEXT,
    "license_number" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "city" TEXT,
    "district" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "pharmacies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_pharmacy_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OWNER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pharmacy_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "category_id" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "description" TEXT,
    "reference" TEXT,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "invoice_id" TEXT,
    "file_import_id" TEXT,
    "tags" TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "subtotal" DECIMAL(15,2) NOT NULL,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "notes" TEXT,
    "file_import_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "product_id" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" TEXT,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tax_number" TEXT,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "barcode_type" TEXT,
    "sku" TEXT,
    "category" TEXT,
    "unit" TEXT,
    "purchase_price" DECIMAL(15,2),
    "sale_price" DECIMAL(15,2),
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "current_stock" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "min_stock" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "max_stock" DECIMAL(10,3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit_cost" DECIMAL(15,2),
    "reference" TEXT,
    "notes" TEXT,
    "stock_before" DECIMAL(10,3) NOT NULL,
    "stock_after" DECIMAL(10,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_imports" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_type" "FileType" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "module" "ImportModule" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_import_rows" (
    "id" TEXT NOT NULL,
    "file_import_id" TEXT NOT NULL,
    "row_index" INTEGER NOT NULL,
    "raw_data" JSONB NOT NULL,
    "parsed_data" JSONB,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "errors" JSONB,
    "is_imported" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promissory_notes" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "note_number" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "notes" TEXT,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "installment_group_id" TEXT,
    "installment_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "promissory_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_expenses" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "type" "FixedExpenseType" NOT NULL,
    "custom_type" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "expense_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fixed_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "identity_number" TEXT,
    "phone" TEXT,
    "start_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_expenses" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "expense_date" TIMESTAMP(3) NOT NULL,
    "salary_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgk_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "food_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "transport_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "employee_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_registers" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "register_date" TIMESTAMP(3) NOT NULL,
    "pos_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cash_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "wire_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "foreign_currency_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "foreign_currency_type" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "daily_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgk_invoices" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "invoice_type" "SgkInvoiceType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "expected_payment_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sgk_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_incomes" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "platform_name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "income_date" TIMESTAMP(3) NOT NULL,
    "expected_payment_date" TIMESTAMP(3) NOT NULL,
    "status" "PlatformIncomeStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "platform_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacies_tax_number_key" ON "pharmacies"("tax_number");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacies_license_number_key" ON "pharmacies"("license_number");

-- CreateIndex
CREATE INDEX "pharmacies_name_idx" ON "pharmacies"("name");

-- CreateIndex
CREATE INDEX "pharmacies_deleted_at_idx" ON "pharmacies"("deleted_at");

-- CreateIndex
CREATE INDEX "user_pharmacy_roles_user_id_idx" ON "user_pharmacy_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_pharmacy_roles_pharmacy_id_idx" ON "user_pharmacy_roles"("pharmacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_pharmacy_roles_user_id_pharmacy_id_key" ON "user_pharmacy_roles"("user_id", "pharmacy_id");

-- CreateIndex
CREATE INDEX "transaction_categories_type_idx" ON "transaction_categories"("type");

-- CreateIndex
CREATE INDEX "transactions_pharmacy_id_transaction_date_idx" ON "transactions"("pharmacy_id", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_pharmacy_id_type_transaction_date_idx" ON "transactions"("pharmacy_id", "type", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_pharmacy_id_category_id_transaction_date_idx" ON "transactions"("pharmacy_id", "category_id", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_deleted_at_idx" ON "transactions"("deleted_at");

-- CreateIndex
CREATE INDEX "invoices_pharmacy_id_invoice_date_idx" ON "invoices"("pharmacy_id", "invoice_date");

-- CreateIndex
CREATE INDEX "invoices_pharmacy_id_status_idx" ON "invoices"("pharmacy_id", "status");

-- CreateIndex
CREATE INDEX "invoices_deleted_at_idx" ON "invoices"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_pharmacy_id_invoice_number_key" ON "invoices"("pharmacy_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_items_product_id_idx" ON "invoice_items"("product_id");

-- CreateIndex
CREATE INDEX "suppliers_pharmacy_id_idx" ON "suppliers"("pharmacy_id");

-- CreateIndex
CREATE INDEX "suppliers_deleted_at_idx" ON "suppliers"("deleted_at");

-- CreateIndex
CREATE INDEX "products_pharmacy_id_name_idx" ON "products"("pharmacy_id", "name");

-- CreateIndex
CREATE INDEX "products_pharmacy_id_barcode_idx" ON "products"("pharmacy_id", "barcode");

-- CreateIndex
CREATE INDEX "products_deleted_at_idx" ON "products"("deleted_at");

-- CreateIndex
CREATE INDEX "stock_movements_pharmacy_id_product_id_created_at_idx" ON "stock_movements"("pharmacy_id", "product_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_pharmacy_id_created_at_idx" ON "stock_movements"("pharmacy_id", "created_at");

-- CreateIndex
CREATE INDEX "file_imports_pharmacy_id_status_idx" ON "file_imports"("pharmacy_id", "status");

-- CreateIndex
CREATE INDEX "file_imports_pharmacy_id_module_idx" ON "file_imports"("pharmacy_id", "module");

-- CreateIndex
CREATE INDEX "file_imports_user_id_idx" ON "file_imports"("user_id");

-- CreateIndex
CREATE INDEX "file_import_rows_file_import_id_is_imported_idx" ON "file_import_rows"("file_import_id", "is_imported");

-- CreateIndex
CREATE INDEX "file_import_rows_file_import_id_is_valid_idx" ON "file_import_rows"("file_import_id", "is_valid");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_pharmacy_id_created_at_idx" ON "audit_logs"("pharmacy_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "promissory_notes_pharmacy_id_due_date_idx" ON "promissory_notes"("pharmacy_id", "due_date");

-- CreateIndex
CREATE INDEX "promissory_notes_installment_group_id_idx" ON "promissory_notes"("installment_group_id");

-- CreateIndex
CREATE INDEX "promissory_notes_deleted_at_idx" ON "promissory_notes"("deleted_at");

-- CreateIndex
CREATE INDEX "fixed_expenses_pharmacy_id_expense_date_idx" ON "fixed_expenses"("pharmacy_id", "expense_date");

-- CreateIndex
CREATE INDEX "fixed_expenses_pharmacy_id_type_idx" ON "fixed_expenses"("pharmacy_id", "type");

-- CreateIndex
CREATE INDEX "fixed_expenses_deleted_at_idx" ON "fixed_expenses"("deleted_at");

-- CreateIndex
CREATE INDEX "employees_pharmacy_id_is_active_idx" ON "employees"("pharmacy_id", "is_active");

-- CreateIndex
CREATE INDEX "employees_deleted_at_idx" ON "employees"("deleted_at");

-- CreateIndex
CREATE INDEX "employee_expenses_pharmacy_id_expense_date_idx" ON "employee_expenses"("pharmacy_id", "expense_date");

-- CreateIndex
CREATE INDEX "employee_expenses_employee_id_expense_date_idx" ON "employee_expenses"("employee_id", "expense_date");

-- CreateIndex
CREATE INDEX "employee_expenses_deleted_at_idx" ON "employee_expenses"("deleted_at");

-- CreateIndex
CREATE INDEX "daily_registers_pharmacy_id_register_date_idx" ON "daily_registers"("pharmacy_id", "register_date");

-- CreateIndex
CREATE INDEX "daily_registers_deleted_at_idx" ON "daily_registers"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "daily_registers_pharmacy_id_register_date_key" ON "daily_registers"("pharmacy_id", "register_date");

-- CreateIndex
CREATE INDEX "sgk_invoices_pharmacy_id_invoice_date_idx" ON "sgk_invoices"("pharmacy_id", "invoice_date");

-- CreateIndex
CREATE INDEX "sgk_invoices_pharmacy_id_expected_payment_date_idx" ON "sgk_invoices"("pharmacy_id", "expected_payment_date");

-- CreateIndex
CREATE INDEX "sgk_invoices_deleted_at_idx" ON "sgk_invoices"("deleted_at");

-- CreateIndex
CREATE INDEX "platform_incomes_pharmacy_id_income_date_idx" ON "platform_incomes"("pharmacy_id", "income_date");

-- CreateIndex
CREATE INDEX "platform_incomes_pharmacy_id_status_idx" ON "platform_incomes"("pharmacy_id", "status");

-- CreateIndex
CREATE INDEX "platform_incomes_pharmacy_id_expected_payment_date_idx" ON "platform_incomes"("pharmacy_id", "expected_payment_date");

-- CreateIndex
CREATE INDEX "platform_incomes_deleted_at_idx" ON "platform_incomes"("deleted_at");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_pharmacy_roles" ADD CONSTRAINT "user_pharmacy_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_pharmacy_roles" ADD CONSTRAINT "user_pharmacy_roles_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_file_import_id_fkey" FOREIGN KEY ("file_import_id") REFERENCES "file_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_file_import_id_fkey" FOREIGN KEY ("file_import_id") REFERENCES "file_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_imports" ADD CONSTRAINT "file_imports_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_imports" ADD CONSTRAINT "file_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_import_rows" ADD CONSTRAINT "file_import_rows_file_import_id_fkey" FOREIGN KEY ("file_import_id") REFERENCES "file_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promissory_notes" ADD CONSTRAINT "promissory_notes_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_expenses" ADD CONSTRAINT "employee_expenses_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_expenses" ADD CONSTRAINT "employee_expenses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_registers" ADD CONSTRAINT "daily_registers_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sgk_invoices" ADD CONSTRAINT "sgk_invoices_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_incomes" ADD CONSTRAINT "platform_incomes_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
