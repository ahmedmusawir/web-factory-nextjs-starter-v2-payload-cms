import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`pages_sections\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`p_text1\` text,
  	\`hero_heading\` text,
  	\`br_text1\` text,
  	\`span_text1\` text,
  	\`span_text2\` text,
  	\`p_text2\` text,
  	\`strong_text1\` text,
  	\`br_text2\` text,
  	\`p_text3\` text,
  	\`img_alt1\` text,
  	\`img_src1_id\` integer,
  	\`h2_text1\` text,
  	\`h3_text1\` text,
  	\`a_href1\` text,
  	\`a_text1\` text,
  	\`a_href2\` text,
  	\`a_text2\` text,
  	\`h3_text2\` text,
  	\`a_href3\` text,
  	\`a_text3\` text,
  	\`h3_text3\` text,
  	\`p_text4\` text,
  	\`a_href4\` text,
  	\`a_text4\` text,
  	\`a_href5\` text,
  	\`a_text5\` text,
  	\`strong_text2\` text,
  	\`strong_text3\` text,
  	\`strong_text4\` text,
  	\`strong_text5\` text,
  	\`strong_text6\` text,
  	\`span_text3\` text,
  	\`span_text4\` text,
  	\`strong_text7\` text,
  	\`br_text3\` text,
  	\`br_text4\` text,
  	\`p_text5\` text,
  	\`p_text6\` text,
  	\`span_text5\` text,
  	\`b_text1\` text,
  	\`i_text1\` text,
  	\`b_text2\` text,
  	\`i_text2\` text,
  	\`b_text3\` text,
  	\`span_text6\` text,
  	\`span_text7\` text,
  	\`span_text8\` text,
  	\`h3_text4\` text,
  	\`span_text9\` text,
  	\`h3_text5\` text,
  	\`p_text7\` text,
  	\`span_text10\` text,
  	\`h3_text6\` text,
  	\`p_text8\` text,
  	\`div_text1\` text,
  	\`small_text1\` text,
  	\`small_text2\` text,
  	\`small_text3\` text,
  	\`div_text2\` text,
  	\`div_text3\` text,
  	\`pre_text1\` text,
  	\`em_text1\` text,
  	\`summary_text1\` text,
  	\`summary_text2\` text,
  	\`summary_text3\` text,
  	\`summary_text4\` text,
  	\`summary_text5\` text,
  	\`small_text4\` text,
  	\`small_text5\` text,
  	\`small_text6\` text,
  	\`small_text7\` text,
  	\`small_text8\` text,
  	\`small_text9\` text,
  	\`strong_text8\` text,
  	\`strong_text9\` text,
  	FOREIGN KEY (\`img_src1_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_sections_order_idx\` ON \`pages_sections\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_sections_parent_id_idx\` ON \`pages_sections\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_sections_img_src1_idx\` ON \`pages_sections\` (\`img_src1_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_version_sections\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`p_text1\` text,
  	\`hero_heading\` text,
  	\`br_text1\` text,
  	\`span_text1\` text,
  	\`span_text2\` text,
  	\`p_text2\` text,
  	\`strong_text1\` text,
  	\`br_text2\` text,
  	\`p_text3\` text,
  	\`img_alt1\` text,
  	\`img_src1_id\` integer,
  	\`h2_text1\` text,
  	\`h3_text1\` text,
  	\`a_href1\` text,
  	\`a_text1\` text,
  	\`a_href2\` text,
  	\`a_text2\` text,
  	\`h3_text2\` text,
  	\`a_href3\` text,
  	\`a_text3\` text,
  	\`h3_text3\` text,
  	\`p_text4\` text,
  	\`a_href4\` text,
  	\`a_text4\` text,
  	\`a_href5\` text,
  	\`a_text5\` text,
  	\`strong_text2\` text,
  	\`strong_text3\` text,
  	\`strong_text4\` text,
  	\`strong_text5\` text,
  	\`strong_text6\` text,
  	\`span_text3\` text,
  	\`span_text4\` text,
  	\`strong_text7\` text,
  	\`br_text3\` text,
  	\`br_text4\` text,
  	\`p_text5\` text,
  	\`p_text6\` text,
  	\`span_text5\` text,
  	\`b_text1\` text,
  	\`i_text1\` text,
  	\`b_text2\` text,
  	\`i_text2\` text,
  	\`b_text3\` text,
  	\`span_text6\` text,
  	\`span_text7\` text,
  	\`span_text8\` text,
  	\`h3_text4\` text,
  	\`span_text9\` text,
  	\`h3_text5\` text,
  	\`p_text7\` text,
  	\`span_text10\` text,
  	\`h3_text6\` text,
  	\`p_text8\` text,
  	\`div_text1\` text,
  	\`small_text1\` text,
  	\`small_text2\` text,
  	\`small_text3\` text,
  	\`div_text2\` text,
  	\`div_text3\` text,
  	\`pre_text1\` text,
  	\`em_text1\` text,
  	\`summary_text1\` text,
  	\`summary_text2\` text,
  	\`summary_text3\` text,
  	\`summary_text4\` text,
  	\`summary_text5\` text,
  	\`small_text4\` text,
  	\`small_text5\` text,
  	\`small_text6\` text,
  	\`small_text7\` text,
  	\`small_text8\` text,
  	\`small_text9\` text,
  	\`strong_text8\` text,
  	\`strong_text9\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`img_src1_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_version_sections_order_idx\` ON \`_pages_v_version_sections\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_sections_parent_id_idx\` ON \`_pages_v_version_sections\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_sections_img_src1_idx\` ON \`_pages_v_version_sections\` (\`img_src1_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings_sections\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`a_href1\` text,
  	\`img_alt1\` text,
  	\`img_src1_id\` integer,
  	\`button_text1\` text,
  	\`span_text1\` text,
  	\`a_href2\` text,
  	\`a_text1\` text,
  	\`button_text2\` text,
  	\`span_text2\` text,
  	\`a_href3\` text,
  	\`a_text2\` text,
  	\`a_href4\` text,
  	\`a_text3\` text,
  	\`a_href5\` text,
  	\`a_text4\` text,
  	\`a_href6\` text,
  	\`a_text5\` text,
  	\`a_href7\` text,
  	\`a_text6\` text,
  	\`a_href8\` text,
  	\`a_text7\` text,
  	\`a_href9\` text,
  	\`a_text8\` text,
  	\`span_text3\` text,
  	\`p_text1\` text,
  	\`h2_text1\` text,
  	\`br_text1\` text,
  	\`p_text2\` text,
  	\`br_text2\` text,
  	\`h3_text1\` text,
  	\`strong_text1\` text,
  	\`br_text3\` text,
  	\`p_text3\` text,
  	\`a_text9\` text,
  	FOREIGN KEY (\`img_src1_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`site_settings_sections_order_idx\` ON \`site_settings_sections\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_sections_parent_id_idx\` ON \`site_settings_sections\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_sections_img_src1_idx\` ON \`site_settings_sections\` (\`img_src1_id\`);`)
  await db.run(sql`ALTER TABLE \`pages\` ADD \`source_i_d\` text;`)
  await db.run(sql`ALTER TABLE \`pages\` ADD \`source_digest\` text;`)
  await db.run(sql`ALTER TABLE \`pages\` ADD \`template\` text;`)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_source_i_d_idx\` ON \`pages\` (\`source_i_d\`);`)
  await db.run(sql`ALTER TABLE \`_pages_v\` ADD \`version_source_i_d\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v\` ADD \`version_source_digest\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v\` ADD \`version_template\` text;`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_source_i_d_idx\` ON \`_pages_v\` (\`version_source_i_d\`);`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`source_i_d\` text;`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`source_digest\` text;`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_source_i_d_idx\` ON \`media\` (\`source_i_d\`);`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`source_i_d\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`contact_provisional\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`contact_phone_href\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`contact_phone_display\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`contact_address_line1\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`contact_address_city\` text;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`pages_sections\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_version_sections\`;`)
  await db.run(sql`DROP TABLE \`site_settings_sections\`;`)
  await db.run(sql`DROP INDEX \`pages_source_i_d_idx\`;`)
  await db.run(sql`ALTER TABLE \`pages\` DROP COLUMN \`source_i_d\`;`)
  await db.run(sql`ALTER TABLE \`pages\` DROP COLUMN \`source_digest\`;`)
  await db.run(sql`ALTER TABLE \`pages\` DROP COLUMN \`template\`;`)
  await db.run(sql`DROP INDEX \`_pages_v_version_version_source_i_d_idx\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v\` DROP COLUMN \`version_source_i_d\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v\` DROP COLUMN \`version_source_digest\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v\` DROP COLUMN \`version_template\`;`)
  await db.run(sql`DROP INDEX \`media_source_i_d_idx\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`source_i_d\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`source_digest\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`source_i_d\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`contact_provisional\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`contact_phone_href\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`contact_phone_display\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`contact_address_line1\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`contact_address_city\`;`)
}
