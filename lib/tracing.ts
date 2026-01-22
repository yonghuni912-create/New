/**
 * OpenTelemetry Tracing Configuration
 * 
 * This module provides distributed tracing capabilities for the BBQ Franchise Platform.
 * Traces are exported via OTLP to a collector (e.g., Jaeger, Zipkin, Honeycomb, etc.)
 * 
 * Environment Variables:
 * - OTEL_SERVICE_NAME: Service name for traces (default: bbq-franchise-platform)
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP collector endpoint (default: http://localhost:4318)
 * - OTEL_TRACES_ENABLED: Enable/disable tracing (default: true in production)
 */

import { trace, context, SpanStatusCode, Span, SpanKind } from '@opentelemetry/api';

// Get tracer instance
const serviceName = process.env.OTEL_SERVICE_NAME || 'bbq-franchise-platform';
export const tracer = trace.getTracer(serviceName, '1.0.0');

/**
 * Wraps an async function with tracing
 */
export async function withTrace<T>(
  spanName: string,
  operation: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }
      
      const result = await operation(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Creates a span for API routes
 */
export async function traceApiRoute<T>(
  method: string,
  path: string,
  handler: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const spanName = `${method} ${path}`;
  return withTrace(spanName, handler, {
    'http.method': method,
    'http.route': path,
    'span.kind': 'server',
    ...attributes,
  });
}

/**
 * Creates a span for database operations
 */
export async function traceDbOperation<T>(
  operation: string,
  table: string,
  handler: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const spanName = `db.${operation}.${table}`;
  return withTrace(spanName, handler, {
    'db.system': 'sqlite',
    'db.operation': operation,
    'db.table': table,
    ...attributes,
  });
}

/**
 * Creates a child span for internal operations
 */
export function createSpan(name: string, attributes?: Record<string, string | number | boolean>): Span {
  const span = tracer.startSpan(name, {
    kind: SpanKind.INTERNAL,
  });
  
  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });
  }
  
  return span;
}

/**
 * Records an error on the current active span
 */
export function recordError(error: Error, attributes?: Record<string, string | number | boolean>): void {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    activeSpan.recordException(error);
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        activeSpan.setAttribute(key, value);
      });
    }
  }
}

/**
 * Adds attributes to the current active span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    Object.entries(attributes).forEach(([key, value]) => {
      activeSpan.setAttribute(key, value);
    });
  }
}

/**
 * Add an event to the current active span
 */
export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.addEvent(name, attributes);
  }
}

export { SpanStatusCode, context };
