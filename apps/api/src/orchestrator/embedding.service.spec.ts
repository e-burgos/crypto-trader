import { EmbeddingService, EMBEDDING_DIMENSIONS } from './embedding.service';

const VECTOR_1024 = () => Array.from({ length: 1024 }, () => 0.1);
const VECTOR_1536 = () => Array.from({ length: 1536 }, () => 0.1);

const ENV_KEYS = [
  'EMBEDDING_PROVIDER',
  'EMBEDDING_MODEL',
  'OPEN_ROUTER_API_KEY',
  'VOYAGE_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_PLATFORM_KEY',
];

describe('EmbeddingService', () => {
  const original: Record<string, string | undefined> = {};
  let post: jest.Mock;

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      original[k] = process.env[k];
      delete process.env[k];
    }
    post = jest.fn();
    // __esModule: true evita que la interop de Jest envuelva el mock una segunda
    // vez: sin eso, `await import('axios')` devuelve { default: { default: ... } }
    // y axios.post queda indefinido.
    jest.doMock('axios', () => ({ __esModule: true, default: { post } }));
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
    jest.resetModules();
  });

  const respuesta = (vectors: number[][]) => ({
    data: { data: vectors.map((embedding) => ({ embedding })) },
  });

  it('la dimension la fija el esquema, no el proveedor', () => {
    expect(new EmbeddingService().dimensions).toBe(1024);
    expect(EMBEDDING_DIMENSIONS).toBe(1024);
  });

  it('usa openrouter por defecto, sin configurar nada', () => {
    expect(new EmbeddingService().provider).toBe('openrouter');
  });

  it('el modelo por defecto de openrouter es text-embedding-3-small', () => {
    expect(new EmbeddingService().model).toBe('openai/text-embedding-3-small');
  });

  it('EMBEDDING_MODEL puede sobrescribir el modelo', () => {
    process.env['EMBEDDING_MODEL'] = 'openai/text-embedding-3-large';
    expect(new EmbeddingService().model).toBe('openai/text-embedding-3-large');
  });

  it('rechaza un proveedor desconocido en vez de caer a uno por defecto', () => {
    process.env['EMBEDDING_PROVIDER'] = 'cohere';
    expect(() => new EmbeddingService().provider).toThrow(/not a known provider/);
  });

  it('sin clave NO cae a otro proveedor: falla y dice por que', async () => {
    // Es el invariante central: un fallback silencioso seguiria indexando con
    // otro modelo y volveria los vectores incomparables con los ya guardados.
    process.env['VOYAGE_API_KEY'] = 'hay-una-de-voyage';
    const { EmbeddingService: S } = await import('./embedding.service');
    await expect(new S().embed(['hola'])).rejects.toThrow(
      /requires OPEN_ROUTER_API_KEY/,
    );
    await expect(new S().embed(['hola'])).rejects.toThrow(
      /no automatic fallback/,
    );
  });

  it('pide 1024 dimensiones explicitamente a openrouter', async () => {
    process.env['OPEN_ROUTER_API_KEY'] = 'k';
    post.mockResolvedValue(respuesta([VECTOR_1024()]));
    const { EmbeddingService: S } = await import('./embedding.service');
    await new S().embed(['hola']);

    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/embeddings');
    expect(body).toMatchObject({
      model: 'openai/text-embedding-3-small',
      dimensions: 1024,
      input: ['hola'],
    });
    expect(config.headers.Authorization).toBe('Bearer k');
  });

  it('rechaza un vector de otra dimension: la base NO lo haria', async () => {
    // La columna embedding es jsonb y acepta cualquier largo en silencio — la
    // columna pgvector la borro la migracion 20260413184109. Este chequeo es la
    // unica defensa que queda.
    process.env['OPEN_ROUTER_API_KEY'] = 'k';
    post.mockResolvedValue(respuesta([VECTOR_1536()]));
    const { EmbeddingService: S } = await import('./embedding.service');
    await expect(new S().embed(['hola'])).rejects.toThrow(
      /returned 1536 dimensions/,
    );
    await expect(new S().embed(['hola'])).rejects.toThrow(
      /stop being comparable/,
    );
  });

  it('rechaza si vuelven menos vectores que textos', async () => {
    process.env['OPEN_ROUTER_API_KEY'] = 'k';
    post.mockResolvedValue(respuesta([VECTOR_1024()]));
    const { EmbeddingService: S } = await import('./embedding.service');
    await expect(new S().embed(['uno', 'dos'])).rejects.toThrow(
      /returned 1 embeddings for 2 inputs/,
    );
  });

  it('openai directo tambien pide 1024, o no entraria en la columna', async () => {
    process.env['EMBEDDING_PROVIDER'] = 'openai';
    process.env['OPENAI_API_KEY'] = 'k';
    post.mockResolvedValue(respuesta([VECTOR_1024()]));
    const { EmbeddingService: S } = await import('./embedding.service');
    await new S().embed(['hola']);
    expect(post.mock.calls[0][1]).toMatchObject({ dimensions: 1024 });
  });

  it('no llama a la red con lista vacia', async () => {
    process.env['OPEN_ROUTER_API_KEY'] = 'k';
    const { EmbeddingService: S } = await import('./embedding.service');
    await expect(new S().embed([])).resolves.toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });
});
