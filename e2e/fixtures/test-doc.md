# Guía de configuración avanzada de stop-loss en CryptoTrader

## Stop-loss dinámico con ATR

El stop-loss automático de CryptoTrader usa el indicador ATR (Average True Range)
multiplicado por un factor configurable (por defecto: 2.0) para calcular el nivel
de stop-loss adaptativo según la volatilidad del mercado.

### Parámetros recomendados

| Perfil      | ATR Multiplier | Max Stop-Loss |
| ----------- | -------------- | ------------- |
| Conservador | 1.5x           | 2%            |
| Moderado    | 2.0x           | 3%            |
| Agresivo    | 3.0x           | 5%            |

## Trailing Stop-Loss

La plataforma soporta trailing stop-loss: el nivel de stop se ajusta
automáticamente conforme el precio sube, asegurando ganancias.

Para habilitar trailing stop-loss en tu configuración, establece el parámetro
`trailingStop` en `true` en la configuración avanzada del agente.

## Stop-Loss por porcentaje fijo

Además del ATR dinámico, puedes configurar un stop-loss de porcentaje fijo.
El valor recomendado es entre el 2% y el 5% del precio de entrada.

Ejemplo: si el precio de compra es $100 y el stop-loss es del 3%,
el agente venderá automáticamente si el precio baja a $97.
