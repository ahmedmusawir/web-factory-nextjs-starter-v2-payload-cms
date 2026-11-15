import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`posts_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`posts_texts_order_parent\` ON \`posts_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_posts_v_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_posts_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_posts_v_texts_order_parent\` ON \`_posts_v_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`ALTER TABLE \`posts\` ADD \`source_i_d\` text;`)
  await db.run(sql`ALTER TABLE \`posts\` ADD \`source_digest\` text;`)
  await db.run(sql`ALTER TABLE \`posts\` ADD \`original_u_r_l\` text;`)
  await db.run(sql`ALTER TABLE \`posts\` ADD \`wordpress_i_d\` numeric;`)
  await db.run(sql`CREATE UNIQUE INDEX \`posts_source_i_d_idx\` ON \`posts\` (\`source_i_d\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`posts_wordpress_i_d_idx\` ON \`posts\` (\`wordpress_i_d\`);`)
  await db.run(sql`ALTER TABLE \`_posts_v\` ADD \`version_source_i_d\` text;`)
  await db.run(sql`ALTER TABLE \`_posts_v\` ADD \`version_source_digest\` text;`)
  await db.run(sql`ALTER TABLE \`_posts_v\` ADD \`version_original_u_r_l\` text;`)
  await db.run(sql`ALTER TABLE \`_posts_v\` ADD \`version_wordpress_i_d\` numeric;`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_source_i_d_idx\` ON \`_posts_v\` (\`version_source_i_d\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_wordpress_i_d_idx\` ON \`_posts_v\` (\`version_wordpress_i_d\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`posts_texts\`;`)
  await db.run(sql`DROP TABLE \`_posts_v_texts\`;`)
  await db.run(sql`DROP INDEX \`posts_source_i_d_idx\`;`)
  await db.run(sql`DROP INDEX \`posts_wordpress_i_d_idx\`;`)
  await db.run(sql`ALTER TABLE \`posts\` DROP COLUMN \`source_i_d\`;`)
  await db.run(sql`ALTER TABLE \`posts\` DROP COLUMN \`source_digest\`;`)
  await db.run(sql`ALTER TABLE \`posts\` DROP COLUMN \`original_u_r_l\`;`)
  await db.run(sql`ALTER TABLE \`posts\` DROP COLUMN \`wordpress_i_d\`;`)
  await db.run(sql`DROP INDEX \`_posts_v_version_version_source_i_d_idx\`;`)
  await db.run(sql`DROP INDEX \`_posts_v_version_version_wordpress_i_d_idx\`;`)
  await db.run(sql`ALTER TABLE \`_posts_v\` DROP COLUMN \`version_source_i_d\`;`)
  await db.run(sql`ALTER TABLE \`_posts_v\` DROP COLUMN \`version_source_digest\`;`)
  await db.run(sql`ALTER TABLE \`_posts_v\` DROP COLUMN \`version_original_u_r_l\`;`)
  await db.run(sql`ALTER TABLE \`_posts_v\` DROP COLUMN \`version_wordpress_i_d\`;`)
}
