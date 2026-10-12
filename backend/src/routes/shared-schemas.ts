export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
}

// format: 'uuid' is not used because Ajv also accepts a "urn:uuid:" prefix, which PostgreSQL rejects.
const uuidPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

export function uuidParamsSchema(paramName: string) {
  return {
    type: 'object',
    additionalProperties: false,
    required: [paramName],
    properties: { [paramName]: { type: 'string', pattern: uuidPattern } },
  };
}

export const nullableString = { type: ['string', 'null'] };

export const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['statusCode', 'error', 'message'],
  properties: {
    statusCode: { type: 'integer' },
    error: { type: 'string' },
    message: { type: 'string' },
  },
};
