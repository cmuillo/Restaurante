import 'dotenv/config';
import { AppDataSource } from '../data-source';
import * as bcrypt from 'bcryptjs';

async function seed() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Obtener o crear sucursal principal
    let branches = await queryRunner.manager.query(
      `SELECT id FROM branches WHERE name = 'Casa Matriz'`,
    );

    let branchId: string;
    if (branches.length > 0) {
      branchId = branches[0].id;
      console.log('ℹ️  Sucursal "Casa Matriz" ya existe.');
    } else {
      const [newBranch] = await queryRunner.manager.query(
        `INSERT INTO branches (id, name, address, phone, email, "isActive")
         VALUES (gen_random_uuid(), 'Casa Matriz', 'Dirección principal', '+1-000-0000', 'admin@restaurante.com', true)
         RETURNING id`,
      );
      branchId = newBranch.id;
      console.log('✅ Sucursal "Casa Matriz" creada.');
    }

    // Configuración de sucursal (si no existe)
    const configExists = await queryRunner.manager.query(
      `SELECT id FROM branch_config WHERE "branchId" = $1`,
      [branchId],
    );

    if (configExists.length === 0) {
      await queryRunner.manager.query(
        `INSERT INTO branch_config (id, "branchId", "taxPercentage", "tipPercentage", currency, "defaultLanguage", "invoicePrefix", "invoiceNextNumber", "kioskEnabled", "kioskInactivitySeconds")
         VALUES (gen_random_uuid(), $1, 16, 10, 'MXN', 'es', 'FAC', 1, true, 60)`,
        [branchId],
      );
    }

    // Crear super admin (si no existe)
    const existing = await queryRunner.manager.query(
      `SELECT id FROM users WHERE email = 'superadmin@restaurante.com'`,
    );

    if (existing.length === 0) {
      const passwordHash = await bcrypt.hash('Admin1234!', 12);
      await queryRunner.manager.query(
        `INSERT INTO users (id, name, email, "passwordHash", role, "branchId", "isActive")
         VALUES (gen_random_uuid(), 'Super Admin', 'superadmin@restaurante.com', $1, 'super_admin', $2, true)`,
        [passwordHash, branchId],
      );
      console.log('✅ Super admin creado: superadmin@restaurante.com / Admin1234!');
    } else {
      // Actualizar el branchId si estaba null
      await queryRunner.manager.query(
        `UPDATE users SET "branchId" = $1 WHERE email = 'superadmin@restaurante.com' AND "branchId" IS NULL`,
        [branchId],
      );
      console.log('ℹ️  Super admin ya existe.');
    }

    await queryRunner.commitTransaction();
    console.log('✅ Seed completado con éxito.');
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Error en seed:', err);
    process.exit(1);
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

seed();
