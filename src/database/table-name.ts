import type { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';

/**
 * Schema-qualified, quoted table name of an entity (`"freitty"."orders"`) for
 * hand-written SQL. The schema is configurable (DB_SCHEMA), so never hard-code it.
 */
export function tableName(dataSource: DataSource, entity: EntityTarget<ObjectLiteral>): string {
  const { schema, tableName: table } = dataSource.getMetadata(entity);
  const escape = (name: string) => dataSource.driver.escape(name);
  return schema ? `${escape(schema)}.${escape(table)}` : escape(table);
}
