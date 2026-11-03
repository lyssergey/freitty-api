import { DefaultNamingStrategy, type NamingStrategyInterface, type Table } from 'typeorm';

const POSTGRES_MAX_IDENTIFIER = 63;

export function snakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * snake_case columns for camelCase properties (`balanceCents` → `balance_cents`,
 * relation `hub` → `hub_id`). Table names are always given explicitly in
 * `@Entity('…')` (plural). Constraint and index names are readable and
 * schema-independent (`fk_orders_hub_id`, `idx_orders_company_id_status`) instead
 * of TypeORM's hashes; the hash is kept only as a fallback for over-long names.
 */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  override tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? snakeCase(targetName);
  }

  override columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    return customName ?? snakeCase([...embeddedPrefixes, propertyName].join('_'));
  }

  override relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(`${relationName}_${referencedColumnName}`);
  }

  override joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return snakeCase(`${tableName}_${columnName ?? propertyName}`);
  }

  override primaryKeyName(table: Table | string, columnNames: string[]): string {
    return this.readable('pk', table, [], () => super.primaryKeyName(table, columnNames));
  }

  override uniqueConstraintName(table: Table | string, columnNames: string[]): string {
    return this.readable('uq', table, columnNames, () =>
      super.uniqueConstraintName(table, columnNames),
    );
  }

  override relationConstraintName(
    table: Table | string,
    columnNames: string[],
    where?: string,
  ): string {
    if (where) return super.relationConstraintName(table, columnNames, where);
    return this.readable('uq', table, columnNames, () =>
      super.relationConstraintName(table, columnNames),
    );
  }

  override foreignKeyName(
    table: Table | string,
    columnNames: string[],
    referencedTablePath?: string,
    referencedColumnNames?: string[],
  ): string {
    return this.readable('fk', table, columnNames, () =>
      super.foreignKeyName(table, columnNames, referencedTablePath, referencedColumnNames),
    );
  }

  override indexName(table: Table | string, columnNames: string[], where?: string): string {
    if (where) return super.indexName(table, columnNames, where);
    return this.readable('idx', table, columnNames, () => super.indexName(table, columnNames));
  }

  /** `<prefix>_<table>[_<columns>]`, falling back to TypeORM's hashed name when too long. */
  private readable(
    prefix: string,
    table: Table | string,
    columnNames: string[],
    fallback: () => string,
  ): string {
    const name = [prefix, this.getTableName(table), ...columnNames].join('_');
    return name.length <= POSTGRES_MAX_IDENTIFIER ? name : fallback();
  }
}
