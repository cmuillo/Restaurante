BEGIN;

DO $$
DECLARE
  v_branch_id uuid;
  v_cashier_id uuid;
  v_waiter_id uuid;
  v_accountant_id uuid;
  v_superadmin_id uuid;
  v_table1_id uuid;
  v_table2_id uuid;
  v_order_base integer;
BEGIN
  SELECT id INTO v_branch_id
  FROM branches
  WHERE name = 'Casa Matriz'
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    SELECT id INTO v_branch_id FROM branches ORDER BY "createdAt" ASC LIMIT 1;
  END IF;

  IF v_branch_id IS NULL THEN
    INSERT INTO branches (name, address, phone, email, "isActive")
    VALUES ('Casa Matriz', 'Dirección principal', '+1-000-0000', 'admin@restaurante.com', true)
    RETURNING id INTO v_branch_id;
  END IF;

  SELECT id INTO v_superadmin_id FROM users WHERE role = 'super_admin'::users_role_enum ORDER BY "createdAt" ASC LIMIT 1;
  SELECT id INTO v_cashier_id FROM users WHERE role = 'cashier'::users_role_enum AND "isActive" = true ORDER BY "createdAt" ASC LIMIT 1;
  SELECT id INTO v_waiter_id FROM users WHERE role = 'waiter'::users_role_enum AND "isActive" = true ORDER BY "createdAt" ASC LIMIT 1;
  SELECT id INTO v_accountant_id FROM users WHERE role = 'accountant'::users_role_enum AND "isActive" = true ORDER BY "createdAt" ASC LIMIT 1;

  IF v_cashier_id IS NULL THEN
    v_cashier_id := v_superadmin_id;
  END IF;

  IF v_waiter_id IS NULL THEN
    v_waiter_id := v_superadmin_id;
  END IF;

  IF v_accountant_id IS NULL THEN
    v_accountant_id := v_superadmin_id;
  END IF;

  INSERT INTO global_settings (id)
  VALUES ('main')
  ON CONFLICT (id) DO NOTHING;

  IF EXISTS (SELECT 1 FROM branch_config WHERE "branchId" = v_branch_id) THEN
    UPDATE branch_config
    SET "businessHours" = '{"monday":{"open":"06:00","close":"21:30","closed":false},"tuesday":{"open":"06:00","close":"22:00","closed":false},"wednesday":{"open":"06:00","close":"22:00","closed":false},"thursday":{"open":"06:00","close":"22:00","closed":false},"friday":{"open":"06:00","close":"22:00","closed":false},"saturday":{"open":"06:00","close":"22:00","closed":false},"sunday":{"open":"06:00","close":"22:00","closed":false}}'::jsonb,
        "updatedAt" = now()
    WHERE "branchId" = v_branch_id;
  ELSE
    INSERT INTO branch_config ("branchId", "taxPercentage", "tipPercentage", currency, "defaultLanguage", "invoicePrefix", "invoiceNextNumber", "kioskEnabled", "kioskInactivitySeconds", "businessHours")
    VALUES (
      v_branch_id,
      13,
      10,
      'CRC',
      'es',
      'FAC',
      1,
      true,
      60,
      '{"monday":{"open":"06:00","close":"21:30","closed":false},"tuesday":{"open":"06:00","close":"22:00","closed":false},"wednesday":{"open":"06:00","close":"22:00","closed":false},"thursday":{"open":"06:00","close":"22:00","closed":false},"friday":{"open":"06:00","close":"22:00","closed":false},"saturday":{"open":"06:00","close":"22:00","closed":false},"sunday":{"open":"06:00","close":"22:00","closed":false}}'::jsonb
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM categories WHERE "branchId" = v_branch_id) THEN
    INSERT INTO categories ("branchId", name, description, "sortOrder", "isActive", "showInKiosk") VALUES
      (v_branch_id, 'Entradas', 'Para abrir apetito', 1, true, true),
      (v_branch_id, 'Platos Fuertes', 'Especialidades de la casa', 2, true, true),
      (v_branch_id, 'Bebidas', 'Frías y calientes', 3, true, true),
      (v_branch_id, 'Postres', 'Dulce final', 4, true, true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM products p
    JOIN categories c ON c.id = p."categoryId"
    WHERE c."branchId" = v_branch_id
  ) THEN
    INSERT INTO products ("categoryId", name, description, price, allergens, "isActive", "showInKiosk", "sortOrder", "taxRate", "pointsPerPurchase")
    VALUES
      ((SELECT id FROM categories WHERE "branchId" = v_branch_id AND name = 'Entradas' LIMIT 1), 'Patacones Mixtos', 'Patacones con frijoles y pico de gallo', 3500, ARRAY[]::text[], true, true, 1, 13, 15),
      ((SELECT id FROM categories WHERE "branchId" = v_branch_id AND name = 'Entradas' LIMIT 1), 'Nachos Supremos', 'Con queso, carne y jalapeno', 4200, ARRAY[]::text[], true, true, 2, 13, 18),
      ((SELECT id FROM categories WHERE "branchId" = v_branch_id AND name = 'Platos Fuertes' LIMIT 1), 'Casado de la Casa', 'Arroz, frijoles, ensalada y proteina', 6500, ARRAY[]::text[], true, true, 1, 13, 30),
      ((SELECT id FROM categories WHERE "branchId" = v_branch_id AND name = 'Platos Fuertes' LIMIT 1), 'Hamburguesa Artesanal', 'Carne premium, queso y papas', 7200, ARRAY[]::text[], true, true, 2, 13, 35),
      ((SELECT id FROM categories WHERE "branchId" = v_branch_id AND name = 'Bebidas' LIMIT 1), 'Limonada Hierbabuena', 'Natural y refrescante', 1900, ARRAY[]::text[], true, true, 1, 13, 10),
      ((SELECT id FROM categories WHERE "branchId" = v_branch_id AND name = 'Bebidas' LIMIT 1), 'Cafe Chorreado', 'Cafe tradicional costarricense', 1500, ARRAY[]::text[], true, true, 2, 13, 8),
      ((SELECT id FROM categories WHERE "branchId" = v_branch_id AND name = 'Postres' LIMIT 1), 'Tres Leches', 'Porcion individual', 2800, ARRAY[]::text[], true, true, 1, 13, 12),
      ((SELECT id FROM categories WHERE "branchId" = v_branch_id AND name = 'Postres' LIMIT 1), 'Flan de Coco', 'Casero', 2500, ARRAY[]::text[], true, true, 2, 13, 10);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tables WHERE "branchId" = v_branch_id) THEN
    INSERT INTO tables ("branchId", number, name, capacity, status, "assignedWaiterId", "positionX", "positionY", "isActive") VALUES
      (v_branch_id, 1, 'Terraza 1', 4, 'occupied'::tables_status_enum, v_waiter_id, 10, 10, true),
      (v_branch_id, 2, 'Terraza 2', 4, 'free'::tables_status_enum, v_waiter_id, 30, 10, true),
      (v_branch_id, 3, 'Salon 1', 6, 'free'::tables_status_enum, v_waiter_id, 50, 20, true),
      (v_branch_id, 4, 'Salon 2', 2, 'waiting_food'::tables_status_enum, v_waiter_id, 70, 20, true),
      (v_branch_id, 5, 'Barra 1', 2, 'reserved'::tables_status_enum, v_waiter_id, 90, 5, true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM customers) THEN
    INSERT INTO customers (name, code, email, phone, "taxId", "taxIdType", address, "loyaltyPoints", "isActive") VALUES
      ('Ana Perez', 'CLI-001', 'ana.perez@email.com', '8888-1111', '1-1111-1111', '01', 'San Jose', 120, true),
      ('Carlos Mena', 'CLI-002', 'carlos.mena@email.com', '8888-2222', '2-2222-2222', '01', 'Heredia', 80, true),
      ('Mariana Solano', 'CLI-003', 'mariana.solano@email.com', '8888-3333', '3-3333-3333', '01', 'Alajuela', 45, true),
      ('Empresa Del Valle S.A.', 'CLI-004', 'compras@delvalle.cr', '2222-4444', '3-101-999999', '02', 'Cartago', 0, true),
      ('Jorge Rojas', 'CLI-005', 'jorge.rojas@email.com', '8888-5555', '4-4444-4444', '01', 'Escazu', 30, true);
  END IF;

  SELECT id INTO v_table1_id FROM tables WHERE "branchId" = v_branch_id AND number = 1 LIMIT 1;
  SELECT id INTO v_table2_id FROM tables WHERE "branchId" = v_branch_id AND number = 4 LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM pos_shifts WHERE "branchId" = v_branch_id) THEN
    INSERT INTO pos_shifts ("branchId", "openedByUserId", status, "openingCash", "openedAt")
    VALUES (v_branch_id, COALESCE(v_cashier_id, v_superadmin_id), 'OPEN'::pos_shifts_status_enum, 150000, now() - interval '4 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM orders WHERE "branchId" = v_branch_id) THEN
    SELECT COALESCE(MAX("orderNumber"), 1000) INTO v_order_base FROM orders WHERE "branchId" = v_branch_id;

    INSERT INTO orders ("branchId", "orderNumber", type, status, "tableId", "userId", "customerId", notes, subtotal, "taxPercentage", "taxAmount", "tipPercentage", "tipAmount", "discountAmount", "pointsUsed", "pointsDiscount", total, "createdAt", "updatedAt") VALUES
      (v_branch_id, v_order_base + 1, 'dine_in'::orders_type_enum, 'completed'::orders_status_enum, v_table1_id, v_waiter_id, (SELECT id FROM customers WHERE code = 'CLI-001' LIMIT 1), 'Sin cebolla', 10000, 13, 1300, 10, 1000, 0, 0, 0, 12300, now() - interval '3 hours', now() - interval '2 hours'),
      (v_branch_id, v_order_base + 2, 'dine_in'::orders_type_enum, 'completed'::orders_status_enum, v_table2_id, v_waiter_id, (SELECT id FROM customers WHERE code = 'CLI-002' LIMIT 1), NULL, 7200, 13, 936, 10, 720, 0, 0, 0, 8856, now() - interval '2 hours', now() - interval '90 minutes'),
      (v_branch_id, v_order_base + 3, 'takeout'::orders_type_enum, 'in_preparation'::orders_status_enum, NULL, v_waiter_id, (SELECT id FROM customers WHERE code = 'CLI-003' LIMIT 1), 'Recoger en 20 min', 5400, 13, 702, 0, 0, 0, 0, 0, 6102, now() - interval '40 minutes', now() - interval '20 minutes'),
      (v_branch_id, v_order_base + 4, 'kiosk'::orders_type_enum, 'pending'::orders_status_enum, NULL, v_waiter_id, NULL, NULL, 4300, 13, 559, 0, 0, 0, 0, 0, 4859, now() - interval '10 minutes', now() - interval '10 minutes');

    INSERT INTO order_items ("orderId", "productId", "productName", "unitPrice", quantity, subtotal, notes, "taxRate") VALUES
      ((SELECT id FROM orders WHERE "branchId" = v_branch_id AND "orderNumber" = v_order_base + 1), (SELECT p.id FROM products p JOIN categories c ON c.id = p."categoryId" WHERE c."branchId" = v_branch_id AND p.name = 'Casado de la Casa' LIMIT 1), 'Casado de la Casa', 6500, 1, 6500, NULL, 13),
      ((SELECT id FROM orders WHERE "branchId" = v_branch_id AND "orderNumber" = v_order_base + 1), (SELECT p.id FROM products p JOIN categories c ON c.id = p."categoryId" WHERE c."branchId" = v_branch_id AND p.name = 'Limonada Hierbabuena' LIMIT 1), 'Limonada Hierbabuena', 1900, 1, 1900, NULL, 13),
      ((SELECT id FROM orders WHERE "branchId" = v_branch_id AND "orderNumber" = v_order_base + 1), (SELECT p.id FROM products p JOIN categories c ON c.id = p."categoryId" WHERE c."branchId" = v_branch_id AND p.name = 'Tres Leches' LIMIT 1), 'Tres Leches', 2800, 1, 2800, NULL, 13),

      ((SELECT id FROM orders WHERE "branchId" = v_branch_id AND "orderNumber" = v_order_base + 2), (SELECT p.id FROM products p JOIN categories c ON c.id = p."categoryId" WHERE c."branchId" = v_branch_id AND p.name = 'Hamburguesa Artesanal' LIMIT 1), 'Hamburguesa Artesanal', 7200, 1, 7200, 'Termino medio', 13),

      ((SELECT id FROM orders WHERE "branchId" = v_branch_id AND "orderNumber" = v_order_base + 3), (SELECT p.id FROM products p JOIN categories c ON c.id = p."categoryId" WHERE c."branchId" = v_branch_id AND p.name = 'Patacones Mixtos' LIMIT 1), 'Patacones Mixtos', 3500, 1, 3500, NULL, 13),
      ((SELECT id FROM orders WHERE "branchId" = v_branch_id AND "orderNumber" = v_order_base + 3), (SELECT p.id FROM products p JOIN categories c ON c.id = p."categoryId" WHERE c."branchId" = v_branch_id AND p.name = 'Cafe Chorreado' LIMIT 1), 'Cafe Chorreado', 1500, 1, 1500, NULL, 13),
      ((SELECT id FROM orders WHERE "branchId" = v_branch_id AND "orderNumber" = v_order_base + 3), (SELECT p.id FROM products p JOIN categories c ON c.id = p."categoryId" WHERE c."branchId" = v_branch_id AND p.name = 'Flan de Coco' LIMIT 1), 'Flan de Coco', 2500, 1, 2500, NULL, 13),

      ((SELECT id FROM orders WHERE "branchId" = v_branch_id AND "orderNumber" = v_order_base + 4), (SELECT p.id FROM products p JOIN categories c ON c.id = p."categoryId" WHERE c."branchId" = v_branch_id AND p.name = 'Nachos Supremos' LIMIT 1), 'Nachos Supremos', 4200, 1, 4200, NULL, 13),
      ((SELECT id FROM orders WHERE "branchId" = v_branch_id AND "orderNumber" = v_order_base + 4), (SELECT p.id FROM products p JOIN categories c ON c.id = p."categoryId" WHERE c."branchId" = v_branch_id AND p.name = 'Cafe Chorreado' LIMIT 1), 'Cafe Chorreado', 1500, 1, 1500, NULL, 13);

    INSERT INTO invoices ("orderId", "invoiceNumber", status, "paymentMethod", "paymentDetails", "customerName", "customerTaxId", "customerAddress", subtotal, "taxAmount", "tipAmount", "discountAmount", total, "cashReceived", "change", "createdAt") VALUES
      ((SELECT id FROM orders WHERE "branchId" = v_branch_id AND "orderNumber" = v_order_base + 1), 'FAC-1001', 'issued'::invoices_status_enum, 'card'::invoices_paymentmethod_enum, '{"last4":"4455"}'::jsonb, 'Ana Perez', '1-1111-1111', 'San Jose', 10000, 1300, 1000, 0, 12300, 0, 0, now() - interval '2 hours'),
      ((SELECT id FROM orders WHERE "branchId" = v_branch_id AND "orderNumber" = v_order_base + 2), 'FAC-1002', 'issued'::invoices_status_enum, 'cash'::invoices_paymentmethod_enum, '{"notes":"Pago exacto"}'::jsonb, 'Carlos Mena', '2-2222-2222', 'Heredia', 7200, 936, 720, 0, 8856, 9000, 144, now() - interval '80 minutes');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM expenses WHERE "branchId" = v_branch_id) THEN
    INSERT INTO expenses ("branchId", category, description, amount, "ivaAmount", date, "supplierName", "receiptNumber", "paymentMethod", "isDeductible", notes, "userId") VALUES
      (v_branch_id, 'Insumos', 'Compra semanal de vegetales', 45000, 5850, current_date - 1, 'Verduras del Norte', 'REC-001', 'transfer'::expenses_paymentmethod_enum, true, 'Factura digital', v_accountant_id),
      (v_branch_id, 'Servicios', 'Internet del local', 28500, 3705, current_date - 2, 'Telecom CR', 'REC-002', 'card'::expenses_paymentmethod_enum, true, NULL, v_accountant_id),
      (v_branch_id, 'Mantenimiento', 'Reparacion de freidora', 62000, 8060, current_date - 3, 'TecnoKitchen', 'REC-003', 'cash'::expenses_paymentmethod_enum, true, 'Atencion urgente', v_accountant_id);
  END IF;
END $$;

COMMIT;
