import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHaciendaProductLegalFields20260505120000 implements MigrationInterface {
  name = 'AddHaciendaProductLegalFields20260505120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cabysCode" character varying(13)`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "commercialCodeType" character varying(2)`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "commercialCode" character varying(50)`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "taxCode" character varying(2)`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "taxRate" numeric(5,2)`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "unitOfMeasure" character varying(5)`);

    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "cabysCode" character varying(13)`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "commercialCodeType" character varying(2)`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "commercialCode" character varying(50)`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "taxCode" character varying(2)`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "taxRate" numeric(5,2)`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "unitOfMeasure" character varying(5)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "unitOfMeasure"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "taxRate"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "taxCode"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "commercialCode"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "commercialCodeType"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "cabysCode"`);

    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "unitOfMeasure"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "taxRate"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "taxCode"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "commercialCode"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "commercialCodeType"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "cabysCode"`);
  }
}
