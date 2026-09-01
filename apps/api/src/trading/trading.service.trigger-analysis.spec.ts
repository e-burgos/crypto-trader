/**
 * FIX-e-burgos-015 — los dos caminos que crean una AgentDecision tienen que
 * persistir los mismos campos de costo.
 *
 * `triggerAnalysis` llamaba a orchestrateDecision, recibia llmCostUsd y
 * llmCallCount, y los descartaba al crear la fila. El camino programado
 * (trading.processor.ts) si los guardaba, asi que el dashboard subreportaba
 * cada vez que alguien apretaba el boton de analisis manual — sin ningun error.
 *
 * Este guard es estatico a proposito: instanciar TradingService exige una decena
 * de colaboradores y el defecto no estaba en la logica sino en un objeto
 * literal, que es justo lo que un guard sobre el fuente detecta bien.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// Solo estos dos existen en el modelo AgentDecision. pricedCallCount y
// unpricedCallCount viven unicamente en el objeto interno del processor, no en
// la tabla: agregarlos al create tira PrismaClientValidationError.
const CAMPOS_DE_COSTO = ['llmCostUsd', 'llmCallCount'] as const;

function bloqueDeCreacion(archivo: string, marcador: string): string {
  const fuente = readFileSync(join(__dirname, archivo), 'utf8');
  const desde = fuente.indexOf(marcador);
  expect(desde).toBeGreaterThan(-1);
  return fuente.slice(desde, desde + 1400);
}

describe('AgentDecision — paridad de campos de costo entre caminos', () => {
  it('triggerAnalysis persiste todos los campos de costo', () => {
    const bloque = bloqueDeCreacion(
      'trading.service.ts',
      'const savedDecision = await this.prisma.agentDecision.create(',
    );
    for (const campo of CAMPOS_DE_COSTO) {
      expect(bloque).toContain(campo);
    }
  });

  it('distingue "costo cero" de "no se pudo tarifar"', () => {
    // La columna es nullable justamente para eso: un 0 significaria que la
    // corrida fue gratis, y eso es una mentira distinta de "no hay tarifa".
    const bloque = bloqueDeCreacion(
      'trading.service.ts',
      'const savedDecision = await this.prisma.agentDecision.create(',
    );
    expect(bloque).toContain('llmCostUsd: result.llmCostUsd ?? null');
    expect(bloque).not.toContain('llmCostUsd: result.llmCostUsd ?? 0');
  });

  it('los contadores caen a 0 y no a null: la columna es Int no-nullable', () => {
    const bloque = bloqueDeCreacion(
      'trading.service.ts',
      'const savedDecision = await this.prisma.agentDecision.create(',
    );
    expect(bloque).toContain('llmCallCount: result.llmCallCount ?? 0');
  });

  it('marca el origen manual, que es lo que permite auditarlos por separado', () => {
    const bloque = bloqueDeCreacion(
      'trading.service.ts',
      'const savedDecision = await this.prisma.agentDecision.create(',
    );
    expect(bloque).toContain('manualTrigger: true');
  });
});
