export interface ListResult<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number };
}
