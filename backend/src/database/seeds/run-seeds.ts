import 'dotenv/config';
import { AppDataSource } from '../data-source';
import * as bcrypt from 'bcrypt';

async function seed() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Crear sucursal principal
    const [branch] = await queryRunner.manager.query(
      `INSERT INTO branches (id, name, address, phone, email, is_active)
       VALUES (gen_random_uuid(), 'Casa Matriz', 'Dirección principal', '+1-000-0000', 'admin@restaurante.com', true)
       ON CONFLICT DO NOTHING
       RETURNING id`,
    );

    const branchId = branch?.id;
    if (!branchId) {
      console.log('La sucursal ya existe, omitiendo seed de sucursal.');
    } else {
      // Configuración de sucursal
      await queryRunner.manager.query(
        `INSERT INTO branch_configs (id, branch_id, tax_percentage, tip_percentage, currency, default_language, invoice_prefix, invoice_next_number, kiosk_enabled, kiosk_inactivity_seconds)
         VALUES (gen_random_uuid(), $1, 16, 10, 'MXN', 'es', 'FAC', 1, true, 60)
         ON CONFLICT DO NOTHING`,
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
        `INSERT INTO users (id, name, email, password_hash, role, is_active)
         VALUES (gen_random_uuid(), 'Super Admin', 'superadmin@restaurante.com', $1, 'super_admin', true)`,
        [passwordHash],
      );
      console.log('✅ Super admin creado: superadmin@restaurante.com / Admin1234!');
    } else {
      console.log('ℹ️  Super admin ya existe, omitiendo.');
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
