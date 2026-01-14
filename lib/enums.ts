// Application-level enums for type safety (since SQLite doesn't support DB enums)

export enum UserRole {
  ADMIN = 'ADMIN',
  PM = 'PM',
  CONTRIBUTOR = 'CONTRIBUTOR',
  VIEWER = 'VIEWER',
}

export enum StoreStatus {
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  READY = 'READY',
  OPEN = 'OPEN',
  DELAYED = 'DELAYED',
  CANCELLED = 'CANCELLED',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum ReschedulePolicy {
  THIS_ONLY = 'THIS_ONLY',
  CASCADE_LATER = 'CASCADE_LATER',
  CASCADE_ALL = 'CASCADE_ALL',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}
