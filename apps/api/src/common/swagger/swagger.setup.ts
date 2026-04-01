import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

export function setupSwagger(app: INestApplication): void {
  if (process.env.NODE_ENV === 'production') return;

  const config = new DocumentBuilder()
    .setTitle('Crypto Trader API')
    .setDescription('Autonomous crypto trading platform — REST API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('auth', 'Registro, login y gestión de sesión')
    .addTag('users', 'Perfil y credenciales del usuario')
    .addTag('admin', 'Operaciones administrativas (solo ADMIN)')
    .addTag('analytics', 'Métricas y reportes del portfolio')
    .addTag('notifications', 'Notificaciones del usuario')
    .addTag('trading', 'Configuración y ciclo de vida del agente de trading')
    .addTag('market', 'Datos de mercado públicos (OHLCV, noticias)')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Serve raw OpenAPI JSON spec
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get(
    '/api/docs-json',
    (_req: unknown, res: { json: (d: unknown) => void }) => {
      res.json(document);
    },
  );

  // Mount Scalar UI
  app.use(
    '/api/docs',
    apiReference({
      spec: { url: '/api/docs-json' },
      theme: 'default',
      darkMode: true,
      metaData: {
        title: 'Crypto Trader API',
        description: 'Autonomous crypto trading platform — REST API',
      },
    }),
  );
}
