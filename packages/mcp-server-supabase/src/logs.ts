import { stripIndent } from 'common-tags';
import type { LogsService } from './platform/types.js';

export function getLogQuery(service: LogsService, limit: number = 100) {
  switch (service) {
    case 'api':
      return stripIndent`
        select id, identifier, timestamp, event_message, request.method, request.path, response.status_code
        from edge_logs
        cross join unnest(metadata) as m
        cross join unnest(m.request) as request
        cross join unnest(m.response) as response
        order by timestamp desc
        limit ${limit}
      `;
    case 'branch-action':
      return stripIndent`
        select workflow_run, workflow_run_logs.timestamp, id, event_message from workflow_run_logs
        order by timestamp desc
        limit ${limit}
      `;
    case 'postgres':
      return stripIndent`
        select identifier, postgres_logs.timestamp, id, event_message, parsed.error_severity from postgres_logs
        cross join unnest(metadata) as m
        cross join unnest(m.parsed) as parsed
        order by timestamp desc
        limit ${limit}
      `;
    case 'edge-function':
      return stripIndent`
        select id, function_edge_logs.timestamp, event_message, response.status_code, request.method, m.function_id, m.execution_time_ms, m.deployment_id, m.version from function_edge_logs
        cross join unnest(metadata) as m
        cross join unnest(m.response) as response
        cross join unnest(m.request) as request
        order by timestamp desc
        limit ${limit}
      `;
    case 'edge-function-runtime':
      return stripIndent`
        select id, function_logs.timestamp, event_message, m.level, m.event_type, m.function_id, m.execution_id, m.deployment_id, m.version from function_logs
        cross join unnest(metadata) as m
        order by timestamp desc
        limit ${limit}
      `;
    case 'auth':
      return stripIndent`
        select id, auth_logs.timestamp, event_message, metadata.level, metadata.status, metadata.path, metadata.msg as msg, metadata.error from auth_logs
        cross join unnest(metadata) as metadata
        order by timestamp desc
        limit ${limit}
      `;
    case 'storage':
      return stripIndent`
        select id, storage_logs.timestamp, event_message from storage_logs
        order by timestamp desc
        limit ${limit}
      `;
    case 'realtime':
      return stripIndent`
        select id, realtime_logs.timestamp, event_message from realtime_logs
        order by timestamp desc
        limit ${limit}
      `;
    default:
      throw new Error(`unsupported log service type: ${service}`);
  }
}

export function getClickHouseLogQuery(
  service: LogsService,
  limit: number = 100
) {
  switch (service) {
    case 'api':
      return stripIndent`
        select id, log_attributes['identifier'] as identifier, timestamp, event_message, log_attributes['request.method'] as method, log_attributes['request.path'] as path, log_attributes['response.status_code'] as status_code
        from logs
        where source = 'edge_logs'
        order by timestamp desc
        limit ${limit}
      `;
    case 'branch-action':
      return stripIndent`
        select log_attributes['workflow_run'] as workflow_run, timestamp, id, event_message
        from logs
        where source = 'workflow_run_logs'
        order by timestamp desc
        limit ${limit}
      `;
    case 'postgres':
      return stripIndent`
        select log_attributes['identifier'] as identifier, timestamp, id, event_message, log_attributes['parsed.error_severity'] as error_severity
        from logs
        where source = 'postgres_logs'
        order by timestamp desc
        limit ${limit}
      `;
    case 'edge-function':
      return stripIndent`
        select id, timestamp, event_message, log_attributes['response.status_code'] as status_code, log_attributes['request.method'] as method, log_attributes['function_id'] as function_id, log_attributes['execution_time_ms'] as execution_time_ms, log_attributes['deployment_id'] as deployment_id, log_attributes['version'] as version
        from logs
        where source = 'function_edge_logs'
        order by timestamp desc
        limit ${limit}
      `;
    case 'edge-function-runtime':
      return stripIndent`
        select id, timestamp, event_message, severity_text, log_attributes['level'] as level, log_attributes['event_type'] as event_type, log_attributes['function_id'] as function_id, log_attributes['execution_id'] as execution_id, log_attributes['deployment_id'] as deployment_id, log_attributes['version'] as version
        from logs
        where source = 'function_logs'
        order by timestamp desc
        limit ${limit}
      `;
    case 'auth':
      return stripIndent`
        select id, timestamp, event_message, log_attributes['level'] as level, log_attributes['status'] as status, log_attributes['path'] as path, log_attributes['msg'] as msg, log_attributes['error'] as error
        from logs
        where source = 'auth_logs'
        order by timestamp desc
        limit ${limit}
      `;
    case 'storage':
      return stripIndent`
        select id, timestamp, event_message
        from logs
        where source = 'storage_logs'
        order by timestamp desc
        limit ${limit}
      `;
    case 'realtime':
      return stripIndent`
        select id, timestamp, event_message
        from logs
        where source = 'realtime_logs'
        order by timestamp desc
        limit ${limit}
      `;
    default:
      throw new Error(`unsupported log service type: ${service}`);
  }
}
