import { stripIndent } from 'common-tags';
import type { LogsService } from './platform/types.js';

type LogQueryOptions = {
  limit?: number;
  functionId?: string;
  search?: string;
};

function parseOptions(
  options: LogQueryOptions | number = {}
): { limit: number; functionId?: string; search?: string } {
  return typeof options === 'number'
    ? { limit: options }
    : { limit: options.limit ?? 100, ...options };
}

function sqlString(value: string) {
  return value.replaceAll("'", "''");
}

function buildSearchFilter(search: string | undefined, columns: string[]) {
  if (!search) return '';

  const pattern = sqlString(`%${search}%`);
  return `and (${columns
    .map((column) => `${column} ilike '${pattern}'`)
    .join(' or ')})`;
}

function buildFunctionIdFilter(
  functionId: string | undefined,
  column: string
) {
  if (!functionId) return '';

  const escaped = sqlString(functionId);
  return `and ${column} = '${escaped}'`;
}

export function getLogQuery(
  service: LogsService,
  options: LogQueryOptions | number = {}
) {
  const { limit, functionId, search } = parseOptions(options);

  switch (service) {
    case 'api': {
      const searchFilter = buildSearchFilter(search, [
        'event_message',
        'identifier',
        'request.method',
        'request.path',
        'cast(response.status_code as text)',
      ]);
      return stripIndent`
        select id, identifier, timestamp, event_message, request.method, request.path, response.status_code
        from edge_logs
        cross join unnest(metadata) as m
        cross join unnest(m.request) as request
        cross join unnest(m.response) as response
        where 1=1 ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    }
    case 'branch-action': {
      const searchFilter = buildSearchFilter(search, [
        'event_message',
        'workflow_run',
      ]);
      return stripIndent`
        select workflow_run, workflow_run_logs.timestamp, id, event_message from workflow_run_logs
        where 1=1 ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    }
    case 'postgres': {
      const searchFilter = buildSearchFilter(search, [
        'event_message',
        'identifier',
        'parsed.error_severity',
      ]);
      return stripIndent`
        select identifier, postgres_logs.timestamp, id, event_message, parsed.error_severity from postgres_logs
        cross join unnest(metadata) as m
        cross join unnest(m.parsed) as parsed
        where 1=1 ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    }
    case 'edge-function': {
      const searchFilter = buildSearchFilter(search, [
        'event_message',
        'm.function_id',
        'request.method',
        'request.path',
        'm.deployment_id',
        'm.version',
        'cast(response.status_code as text)',
      ]);
      const functionFilter = buildFunctionIdFilter(functionId, 'm.function_id');
      return stripIndent`
        select id, function_edge_logs.timestamp, event_message, response.status_code, request.method, m.function_id, m.execution_time_ms, m.deployment_id, m.version from function_edge_logs
        cross join unnest(metadata) as m
        cross join unnest(m.response) as response
        cross join unnest(m.request) as request
        where 1=1 ${functionFilter} ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    }
    case 'edge-function-runtime': {
      const searchFilter = buildSearchFilter(search, [
        'event_message',
        'm.function_id',
        'm.execution_id',
        'm.deployment_id',
        'm.version',
        'm.level',
        'm.event_type',
      ]);
      const functionFilter = buildFunctionIdFilter(functionId, 'm.function_id');
      return stripIndent`
        select id, function_logs.timestamp, event_message, m.level, m.event_type, m.function_id, m.execution_id, m.deployment_id, m.version from function_logs
        cross join unnest(metadata) as m
        where 1=1 ${functionFilter} ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    }
    case 'auth': {
      const searchFilter = buildSearchFilter(search, [
        'event_message',
        'metadata.level',
        'metadata.status',
        'metadata.path',
        'metadata.msg',
        'metadata.error',
      ]);
      return stripIndent`
        select id, auth_logs.timestamp, event_message, metadata.level, metadata.status, metadata.path, metadata.msg as msg, metadata.error from auth_logs
        cross join unnest(metadata) as metadata
        where 1=1 ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    }
    case 'storage': {
      const searchFilter = buildSearchFilter(search, ['event_message', 'id']);
      return stripIndent`
        select id, storage_logs.timestamp, event_message from storage_logs
        where 1=1 ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    }
    case 'realtime': {
      const searchFilter = buildSearchFilter(search, ['event_message', 'id']);
      return stripIndent`
        select id, realtime_logs.timestamp, event_message from realtime_logs
        where 1=1 ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    }
    default:
      throw new Error(`unsupported log service type: ${service}`);
  }
}

export function getClickHouseLogQuery(
  service: LogsService,
  options: LogQueryOptions | number = {}
) {
  const { limit, functionId, search } = parseOptions(options);
  const functionFilter = buildFunctionIdFilter(
    functionId,
    "log_attributes['function_id']"
  );
  const searchFilter = buildSearchFilter(search, [
    'event_message',
    "log_attributes['function_id']",
    "log_attributes['execution_id']",
    "log_attributes['deployment_id']",
    "log_attributes['version']",
    "log_attributes['level']",
    "log_attributes['event_type']",
  ]);

  switch (service) {
    case 'api': {
      const searchFilter = buildSearchFilter(search, [
        'event_message',
        "log_attributes['identifier']",
        "log_attributes['request.method']",
        "log_attributes['request.path']",
        "cast(log_attributes['response.status_code'] as text)",
      ]);
      return stripIndent`
        select id, log_attributes['identifier'] as identifier, timestamp, event_message, log_attributes['request.method'] as method, log_attributes['request.path'] as path, log_attributes['response.status_code'] as status_code
        from logs
        where source = 'edge_logs' ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    }
    case 'branch-action': {
      const searchFilter = buildSearchFilter(search, [
        'event_message',
        "log_attributes['workflow_run']",
      ]);
      return stripIndent`
        select log_attributes['workflow_run'] as workflow_run, timestamp, id, event_message
        from logs
        where source = 'workflow_run_logs' ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    }
    case 'postgres': {
      const searchFilter = buildSearchFilter(search, [
        'event_message',
        "log_attributes['identifier']",
        "log_attributes['parsed.error_severity']",
      ]);
      return stripIndent`
        select log_attributes['identifier'] as identifier, timestamp, id, event_message, log_attributes['parsed.error_severity'] as error_severity
        from logs
        where source = 'postgres_logs' ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    }
    case 'edge-function':
      return stripIndent`
        select id, timestamp, event_message, log_attributes['response.status_code'] as status_code, log_attributes['request.method'] as method, log_attributes['function_id'] as function_id, log_attributes['execution_time_ms'] as execution_time_ms, log_attributes['deployment_id'] as deployment_id, log_attributes['version'] as version
        from logs
        where source = 'function_edge_logs' ${functionFilter} ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    case 'edge-function-runtime':
      return stripIndent`
        select id, timestamp, event_message, severity_text, log_attributes['level'] as level, log_attributes['event_type'] as event_type, log_attributes['function_id'] as function_id, log_attributes['execution_id'] as execution_id, log_attributes['deployment_id'] as deployment_id, log_attributes['version'] as version
        from logs
        where source = 'function_logs' ${functionFilter} ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    case 'auth': {
      const searchFilter = buildSearchFilter(search, [
        'event_message',
        "log_attributes['level']",
        "log_attributes['status']",
        "log_attributes['path']",
        "log_attributes['msg']",
        "log_attributes['error']",
      ]);
      return stripIndent`
        select id, timestamp, event_message, log_attributes['level'] as level, log_attributes['status'] as status, log_attributes['path'] as path, log_attributes['msg'] as msg, log_attributes['error'] as error
        from logs
        where source = 'auth_logs' ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    }
    case 'storage': {
      const searchFilter = buildSearchFilter(search, [
        'event_message',
        'id',
      ]);
      return stripIndent`
        select id, timestamp, event_message
        from logs
        where source = 'storage_logs' ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    }
    case 'realtime': {
      const searchFilter = buildSearchFilter(search, [
        'event_message',
        'id',
      ]);
      return stripIndent`
        select id, timestamp, event_message
        from logs
        where source = 'realtime_logs' ${searchFilter}
        order by timestamp desc
        limit ${limit}
      `;
    }
    default:
      throw new Error(`unsupported log service type: ${service}`);
  }
}
