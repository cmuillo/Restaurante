import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerExemption20260515100000 implements MigrationInterface {
  name = 'AddCustomerExemption20260515100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "isExempt" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "exemptDocNumber" character varying(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "exemptDocNumber"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "isExempt"`);
  }
}
