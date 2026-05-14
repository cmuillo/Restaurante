import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuotations20260515000000 implements MigrationInterface {
  name = 'CreateQuotations20260515000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."quotations_status_enum" AS ENUM ('draft', 'sent', 'invoiced', 'expired')
    `);

    await queryRunner.query(`
      CREATE TABLE "quotations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "branchId" uuid NOT NULL,
        "quotationNumber" character varying(20) NOT NULL,
        "status" "public"."quotations_status_enum" NOT NULL DEFAULT 'draft',
        "customerId" uuid,
        "notes" text,
        "subtotal" numeric(10,2) NOT NULL DEFAULT '0',
        "taxAmount" numeric(10,2) NOT NULL DEFAULT '0',
        "discountAmount" numeric(10,2) NOT NULL DEFAULT '0',
        "total" numeric(10,2) NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_quotations_number" UNIQUE ("quotationNumber"),
        CONSTRAINT "PK_quotations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "quotation_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotationId" uuid NOT NULL,
        "productId" uuid,
        "productName" character varying(150) NOT NULL,
        "unitPrice" numeric(10,2) NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "taxRate" numeric(5,2) NOT NULL DEFAULT '13',
        "subtotal" numeric(10,2) NOT NULL,
        CONSTRAINT "PK_quotation_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quotation_items_quotation" FOREIGN KEY ("quotationId")
          REFERENCES "quotations"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "quotation_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quotations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."quotations_status_enum"`);
  }
}
