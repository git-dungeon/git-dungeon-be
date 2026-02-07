import SwaggerParser from '@apidevtools/swagger-parser';

export type OpenApiDocument = Record<string, unknown>;

export const loadOpenApiDocument = async (
  absoluteOrRelativePath: string,
): Promise<OpenApiDocument> => {
  const dereferenced = (await SwaggerParser.dereference(
    absoluteOrRelativePath,
    {
      dereference: {
        circular: 'ignore',
      },
    },
  )) as unknown;

  if (!dereferenced || typeof dereferenced !== 'object') {
    throw new Error('OpenAPI document is not an object');
  }

  return dereferenced as OpenApiDocument;
};
