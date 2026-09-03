import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AssetEnum {
  BTC = 'BTC',
  ETH = 'ETH',
}

export enum QuoteCurrencyEnum {
  USDT = 'USDT',
  USDC = 'USDC',
}

export enum TradingModeEnum {
  LIVE = 'LIVE',
  SANDBOX = 'SANDBOX',
  TESTNET = 'TESTNET',
}

export enum IntervalModeEnum {
  AGENT = 'AGENT',
  CUSTOM = 'CUSTOM',
}

export enum RiskProfileEnum {
  CONSERVATIVE = 'CONSERVATIVE',
  MODERATE = 'MODERATE',
  AGGRESSIVE = 'AGGRESSIVE',
}

export enum LLMProviderEnum {
  CLAUDE = 'CLAUDE',
  OPENAI = 'OPENAI',
  GROQ = 'GROQ',
  GEMINI = 'GEMINI',
  MISTRAL = 'MISTRAL',
  TOGETHER = 'TOGETHER',
  OPENROUTER = 'OPENROUTER',
}

export enum EntryOrderModeEnum {
  MARKET = 'MARKET',
  LIMIT_MAKER = 'LIMIT_MAKER',
  OCO = 'OCO',
}

export class CreateTradingConfigDto {
  @ApiPropertyOptional({
    example: 'BTC Agresivo',
    description: 'Nombre descriptivo del agente',
  })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  name?: string;

  @ApiProperty({ enum: AssetEnum, example: AssetEnum.BTC })
  @IsEnum(AssetEnum)
  asset!: AssetEnum;

  @ApiProperty({ enum: QuoteCurrencyEnum, example: QuoteCurrencyEnum.USDT })
  @IsEnum(QuoteCurrencyEnum)
  pair!: QuoteCurrencyEnum;

  @ApiProperty({ enum: TradingModeEnum, example: TradingModeEnum.SANDBOX })
  @IsEnum(TradingModeEnum)
  mode!: TradingModeEnum;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    example: 70,
    description: 'Confianza mínima para ejecutar BUY',
  })
  @IsNumber({}, { message: 'Umbral de compra debe ser un número válido' })
  @Min(0, { message: 'Umbral de compra debe ser mayor o igual a $constraint1' })
  @Max(100, { message: 'Umbral de compra no debe superar $constraint1' })
  @IsOptional()
  buyThreshold?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    example: 70,
    description: 'Confianza mínima para ejecutar SELL',
  })
  @IsNumber({}, { message: 'Umbral de venta debe ser un número válido' })
  @Min(0, { message: 'Umbral de venta debe ser mayor o igual a $constraint1' })
  @Max(100, { message: 'Umbral de venta no debe superar $constraint1' })
  @IsOptional()
  sellThreshold?: number;

  @ApiPropertyOptional({
    minimum: 0.001,
    maximum: 0.5,
    example: 0.03,
    description: 'Stop-loss como fracción del precio de entrada',
  })
  @IsNumber({}, { message: 'Stop-loss debe ser un número válido' })
  @Min(0.001, { message: 'Stop-loss debe ser al menos $constraint1 (0.1%)' })
  @Max(0.5, { message: 'Stop-loss no puede superar $constraint1 (50%)' })
  @IsOptional()
  stopLossPct?: number;

  @ApiPropertyOptional({
    minimum: 0.001,
    maximum: 1,
    example: 0.05,
    description: 'Take-profit como fracción del precio de entrada',
  })
  @IsNumber({}, { message: 'Take-profit debe ser un número válido' })
  @Min(0.001, { message: 'Take-profit debe ser al menos $constraint1 (0.1%)' })
  @Max(1, { message: 'Take-profit no puede superar $constraint1 (100%)' })
  @IsOptional()
  takeProfitPct?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 0.5,
    example: 0.003,
    description:
      'Ganancia mínima requerida para ejecutar SELL por decisión LLM (0.003 = 0.3%)',
  })
  @IsNumber({}, { message: 'Ganancia mínima debe ser un número válido' })
  @Min(0, { message: 'Ganancia mínima debe ser mayor o igual a $constraint1' })
  @Max(0.5, { message: 'Ganancia mínima no puede superar $constraint1 (50%)' })
  @IsOptional()
  minProfitPct?: number;

  @ApiPropertyOptional({
    minimum: 0.01,
    maximum: 1,
    example: 0.1,
    description: 'Fracción máxima del balance a usar por trade',
  })
  @IsNumber(
    {},
    { message: 'Porcentaje máximo por trade debe ser un número válido' },
  )
  @Min(0.01, {
    message: 'Porcentaje máximo por trade debe ser al menos $constraint1',
  })
  @Max(1, {
    message: 'Porcentaje máximo por trade no puede superar $constraint1 (100%)',
  })
  @IsOptional()
  maxTradePct?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 10,
    example: 3,
    description: 'Máximo de posiciones abiertas simultáneas',
  })
  @IsNumber(
    {},
    { message: 'Máximo de posiciones concurrentes debe ser un número válido' },
  )
  @Min(1, {
    message: 'Máximo de posiciones concurrentes debe ser al menos $constraint1',
  })
  @Max(10, {
    message: 'Máximo de posiciones concurrentes no puede superar $constraint1',
  })
  @IsOptional()
  maxConcurrentPositions?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 1440,
    example: 60,
    description: 'Intervalo mínimo entre ciclos en minutos',
  })
  @IsNumber({}, { message: 'Intervalo mínimo debe ser un número válido' })
  @Min(1, { message: 'Intervalo mínimo debe ser al menos $constraint1 minuto' })
  @Max(1440, {
    message: 'Intervalo mínimo no puede superar $constraint1 minutos (24hs)',
  })
  @IsOptional()
  minIntervalMinutes?: number;

  @ApiPropertyOptional({
    minimum: -0.05,
    maximum: 0.05,
    example: 0,
    description:
      'Offset de precio relativo al mercado para la ejecución de órdenes. ' +
      'Negativo = intenta comprar por debajo del precio de mercado (simulación). ' +
      'Positivo = ejecuta por encima del precio de mercado.',
  })
  @IsNumber({}, { message: 'Offset de precio debe ser un número válido' })
  @Min(-0.05, { message: 'Offset de precio no puede ser menor a -5%' })
  @Max(0.05, { message: 'Offset de precio no puede superar +5%' })
  @IsOptional()
  orderPriceOffsetPct?: number;

  @ApiPropertyOptional({
    enum: IntervalModeEnum,
    example: IntervalModeEnum.AGENT,
    description:
      'AGENT = respeta la sugerencia del LLM; CUSTOM = usa minIntervalMinutes fijo',
  })
  @IsEnum(IntervalModeEnum)
  @IsOptional()
  intervalMode?: IntervalModeEnum;

  @ApiPropertyOptional({
    enum: RiskProfileEnum,
    example: RiskProfileEnum.MODERATE,
    description: 'Risk profile for model selection and prompts',
  })
  @IsEnum(RiskProfileEnum)
  @IsOptional()
  riskProfile?: RiskProfileEnum;

  @ApiPropertyOptional({
    example: false,
    description:
      'Interruptor maestro del corte de pérdida por señal. false = veto actual de minProfitPct intacto',
  })
  @IsBoolean()
  @IsOptional()
  lossCutEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 1,
    example: 0.85,
    description: 'Confianza mínima (0..1) del agente para habilitar la venta en pérdida',
  })
  @IsNumber({}, { message: 'Umbral de confianza de corte de pérdida debe ser un número válido' })
  @Min(0, { message: 'Umbral de confianza de corte de pérdida debe ser mayor o igual a $constraint1' })
  @Max(1, { message: 'Umbral de confianza de corte de pérdida no puede superar $constraint1' })
  @IsOptional()
  lossCutConfidenceThreshold?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 0.5,
    example: 0.005,
    description: 'Pérdida mínima (fracción) para considerar el corte de pérdida — evita churn por ruido',
  })
  @IsNumber({}, { message: 'Pérdida mínima de corte debe ser un número válido' })
  @Min(0, { message: 'Pérdida mínima de corte debe ser mayor o igual a $constraint1' })
  @Max(0.5, { message: 'Pérdida mínima de corte no puede superar $constraint1' })
  @IsOptional()
  lossCutMinLossPct?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    example: 2,
    description: 'Múltiplo de la fricción de salida que la pérdida evitada debe superar',
  })
  @IsNumber({}, { message: 'Ratio de borde de corte de pérdida debe ser un número válido' })
  @Min(0, { message: 'Ratio de borde de corte de pérdida debe ser mayor o igual a $constraint1' })
  @Max(100, { message: 'Ratio de borde de corte de pérdida no puede superar $constraint1' })
  @IsOptional()
  lossCutMinEdgeRatio?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'false = executeBuy usa calculateTradeQuantity sin modulación (factor 1, sin AEGIS ni FORGE)',
  })
  @IsBoolean()
  @IsOptional()
  smartSizingEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: 0.05,
    maximum: 1,
    example: 0.5,
    description: 'Factor aplicado cuando el verdict de AEGIS es REDUCE',
  })
  @IsNumber({}, { message: 'Factor de reducción de tamaño debe ser un número válido' })
  @Min(0.05, { message: 'Factor de reducción de tamaño debe ser al menos $constraint1' })
  @Max(1, { message: 'Factor de reducción de tamaño no puede superar $constraint1' })
  @IsOptional()
  reduceSizeFactor?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Coloca OCO real al abrir posición (solo LIVE/TESTNET; se ignora en SANDBOX)',
  })
  @IsBoolean()
  @IsOptional()
  nativeProtectionEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Opt-in agresivo: cerrar a mercado si la protección no se logra colocar tras los reintentos',
  })
  @IsBoolean()
  @IsOptional()
  closeOnProtectionFailure?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 0.05,
    example: 0.002,
    description:
      'Distancia entre el stopPrice y el price límite de la pierna STOP_LOSS_LIMIT',
  })
  @IsNumber({}, { message: 'Offset de stop-limit debe ser un número válido' })
  @Min(0, { message: 'Offset de stop-limit debe ser mayor o igual a $constraint1' })
  @Max(0.05, { message: 'Offset de stop-limit no puede superar $constraint1' })
  @IsOptional()
  stopLimitOffsetPct?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Activa el trailing stop. Mientras esté activo, el take-profit fijo queda desactivado',
  })
  @IsBoolean()
  @IsOptional()
  trailingStopEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: 0.001,
    maximum: 1,
    example: 0.02,
    description: 'Distancia del stop bajo el máximo visto (trailing)',
  })
  @IsNumber({}, { message: 'Porcentaje de trailing stop debe ser un número válido' })
  @Min(0.001, { message: 'Porcentaje de trailing stop debe ser al menos $constraint1' })
  @Max(1, { message: 'Porcentaje de trailing stop no puede superar $constraint1' })
  @IsOptional()
  trailingStopPct?: number;

  @ApiPropertyOptional({
    minimum: 0.001,
    maximum: 1,
    example: 0.01,
    description: 'Ganancia no realizada mínima para empezar a trailear',
  })
  @IsNumber({}, { message: 'Porcentaje de activación de trailing debe ser un número válido' })
  @Min(0.001, { message: 'Porcentaje de activación de trailing debe ser al menos $constraint1' })
  @Max(1, { message: 'Porcentaje de activación de trailing no puede superar $constraint1' })
  @IsOptional()
  trailingActivationPct?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Activa la venta parcial escalonada de take-profit',
  })
  @IsBoolean()
  @IsOptional()
  partialTpEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: 0.001,
    maximum: 1,
    example: 0.02,
    description: 'Ganancia que dispara la venta parcial',
  })
  @IsNumber({}, { message: 'Porcentaje de disparo de TP parcial debe ser un número válido' })
  @Min(0.001, { message: 'Porcentaje de disparo de TP parcial debe ser al menos $constraint1' })
  @Max(1, { message: 'Porcentaje de disparo de TP parcial no puede superar $constraint1' })
  @IsOptional()
  partialTpTriggerPct?: number;

  @ApiPropertyOptional({
    minimum: 0.05,
    maximum: 1,
    example: 0.5,
    description: 'Fracción de la posición que se vende en el TP parcial',
  })
  @IsNumber({}, { message: 'Porcentaje de venta de TP parcial debe ser un número válido' })
  @Min(0.05, { message: 'Porcentaje de venta de TP parcial debe ser al menos $constraint1' })
  @Max(1, { message: 'Porcentaje de venta de TP parcial no puede superar $constraint1' })
  @IsOptional()
  partialTpSellPct?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Tras el TP parcial, sube el stop a breakeven neto de fees',
  })
  @IsBoolean()
  @IsOptional()
  moveStopToBreakevenAfterPartial?: boolean;

  @ApiPropertyOptional({
    minimum: 5,
    maximum: 43200,
    example: 1440,
    description: 'Antigüedad máxima (minutos) de una posición antes de cerrarla por tiempo. null = desactivado',
  })
  @IsInt({ message: 'Máximo de minutos de posición abierta debe ser un entero' })
  @Min(5, { message: 'Máximo de minutos de posición abierta debe ser al menos $constraint1' })
  @Max(43200, { message: 'Máximo de minutos de posición abierta no puede superar $constraint1' })
  @IsOptional()
  maxPositionHoldMinutes?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Activa el gate determinista pre-LLM: si el mercado no muestra señal desde la última decisión, resuelve HOLD sin llamar al LLM',
  })
  @IsBoolean()
  @IsOptional()
  deterministicGateEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: 0.0005,
    maximum: 0.05,
    example: 0.005,
    description:
      'Umbral de cambio de precio del gate determinista (fracción). Por debajo, el gate nunca aplica; por encima, silencia movimientos relevantes',
  })
  @IsNumber({}, { message: 'Umbral de cambio de precio del gate debe ser un número válido' })
  @Min(0.0005, { message: 'Umbral de cambio de precio del gate debe ser al menos $constraint1 (0.05%)' })
  @Max(0.05, { message: 'Umbral de cambio de precio del gate no puede superar $constraint1 (5%)' })
  @IsOptional()
  gatePriceChangePct?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Interruptor maestro del ciclo reactivo. false = el bot solo actúa por el ciclo LLM periódico',
  })
  @IsBoolean()
  @IsOptional()
  reactiveLoopEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 60,
    example: 6,
    description: 'Cap de acciones por hora móvil del ciclo reactivo (por bot)',
  })
  @IsInt({ message: 'Máximo de acciones por hora debe ser un entero' })
  @Min(1, { message: 'Máximo de acciones por hora debe ser al menos $constraint1' })
  @Max(60, { message: 'Máximo de acciones por hora no puede superar $constraint1' })
  @IsOptional()
  maxActionsPerHour?: number;

  @ApiPropertyOptional({
    minimum: 5,
    maximum: 3600,
    example: 60,
    description: 'Tiempo mínimo en segundos entre acciones ejecutadas por el ciclo reactivo (por bot)',
  })
  @IsInt({ message: 'Intervalo mínimo entre acciones debe ser un entero' })
  @Min(5, { message: 'Intervalo mínimo entre acciones debe ser al menos $constraint1 segundos' })
  @Max(3600, { message: 'Intervalo mínimo entre acciones no puede superar $constraint1 segundos' })
  @IsOptional()
  minActionIntervalSec?: number;

  @ApiPropertyOptional({
    enum: EntryOrderModeEnum,
    example: EntryOrderModeEnum.MARKET,
    description:
      'Modo de la orden de entrada. MARKET = compra a mercado (comportamiento actual). ' +
      'LIMIT_MAKER = entrada descansando en el soporte. OCO = soporte + ruptura. ' +
      'Se ignora en modo SANDBOX.',
  })
  @IsEnum(EntryOrderModeEnum)
  @IsOptional()
  entryOrderMode?: EntryOrderModeEnum;

  @ApiPropertyOptional({
    minimum: 5,
    maximum: 1440,
    example: 120,
    description: 'Minutos desde placedAt tras los que una entrada sin fill vence y se cancela',
  })
  @IsInt({ message: 'TTL de la entrada debe ser un entero' })
  @Min(5, { message: 'TTL de la entrada debe ser al menos $constraint1 minutos' })
  @Max(1440, { message: 'TTL de la entrada no puede superar $constraint1 minutos (24hs)' })
  @IsOptional()
  entryOrderTtlMinutes?: number;

  @ApiPropertyOptional({
    minimum: 10,
    maximum: 2000,
    example: 100,
    description:
      'trailingDelta en BIPS de la pierna de ruptura del OCO de entrada (100 = 1%). ' +
      'Omitirlo deja la pierna en nivel fijo. El rango real lo fija el filtro TRAILING_DELTA del símbolo.',
  })
  @IsInt({ message: 'Trailing delta de entrada debe ser un entero en BIPS' })
  @Min(10, { message: 'Trailing delta de entrada debe ser al menos $constraint1 BIPS' })
  @Max(2000, { message: 'Trailing delta de entrada no puede superar $constraint1 BIPS' })
  @IsOptional()
  entryTrailingDeltaBips?: number;
}

export class UpdateTradingConfigDto {
  @ApiPropertyOptional({
    example: 'BTC Agresivo',
    description: 'Nombre descriptivo del agente',
  })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: TradingModeEnum })
  @IsEnum(TradingModeEnum)
  @IsOptional()
  mode?: TradingModeEnum;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 70 })
  @IsNumber({}, { message: 'Umbral de compra debe ser un número válido' })
  @Min(0, { message: 'Umbral de compra debe ser mayor o igual a $constraint1' })
  @Max(100, { message: 'Umbral de compra no debe superar $constraint1' })
  @IsOptional()
  buyThreshold?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 70 })
  @IsNumber({}, { message: 'Umbral de venta debe ser un número válido' })
  @Min(0, { message: 'Umbral de venta debe ser mayor o igual a $constraint1' })
  @Max(100, { message: 'Umbral de venta no debe superar $constraint1' })
  @IsOptional()
  sellThreshold?: number;

  @ApiPropertyOptional({ minimum: 0.001, maximum: 0.5, example: 0.03 })
  @IsNumber({}, { message: 'Stop-loss debe ser un número válido' })
  @Min(0.001, { message: 'Stop-loss debe ser al menos $constraint1 (0.1%)' })
  @Max(0.5, { message: 'Stop-loss no puede superar $constraint1 (50%)' })
  @IsOptional()
  stopLossPct?: number;

  @ApiPropertyOptional({ minimum: 0.001, maximum: 1, example: 0.05 })
  @IsNumber({}, { message: 'Take-profit debe ser un número válido' })
  @Min(0.001, { message: 'Take-profit debe ser al menos $constraint1 (0.1%)' })
  @Max(1, { message: 'Take-profit no puede superar $constraint1 (100%)' })
  @IsOptional()
  takeProfitPct?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 0.5,
    example: 0.003,
    description:
      'Ganancia mínima requerida para ejecutar SELL por decisión LLM (0.003 = 0.3%)',
  })
  @IsNumber({}, { message: 'Ganancia mínima debe ser un número válido' })
  @Min(0, { message: 'Ganancia mínima debe ser mayor o igual a $constraint1' })
  @Max(0.5, { message: 'Ganancia mínima no puede superar $constraint1 (50%)' })
  @IsOptional()
  minProfitPct?: number;

  @ApiPropertyOptional({ minimum: 0.01, maximum: 1, example: 0.1 })
  @IsNumber(
    {},
    { message: 'Porcentaje máximo por trade debe ser un número válido' },
  )
  @Min(0.01, {
    message: 'Porcentaje máximo por trade debe ser al menos $constraint1',
  })
  @Max(1, {
    message: 'Porcentaje máximo por trade no puede superar $constraint1 (100%)',
  })
  @IsOptional()
  maxTradePct?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, example: 3 })
  @IsNumber(
    {},
    { message: 'Máximo de posiciones concurrentes debe ser un número válido' },
  )
  @Min(1, {
    message: 'Máximo de posiciones concurrentes debe ser al menos $constraint1',
  })
  @Max(10, {
    message: 'Máximo de posiciones concurrentes no puede superar $constraint1',
  })
  @IsOptional()
  maxConcurrentPositions?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440, example: 60 })
  @IsNumber({}, { message: 'Intervalo mínimo debe ser un número válido' })
  @Min(1, { message: 'Intervalo mínimo debe ser al menos $constraint1 minuto' })
  @Max(1440, {
    message: 'Intervalo mínimo no puede superar $constraint1 minutos (24hs)',
  })
  @IsOptional()
  minIntervalMinutes?: number;

  @ApiPropertyOptional({ minimum: -0.05, maximum: 0.05, example: 0 })
  @IsNumber({}, { message: 'Offset de precio debe ser un número válido' })
  @Min(-0.05, { message: 'Offset de precio no puede ser menor a -5%' })
  @Max(0.05, { message: 'Offset de precio no puede superar +5%' })
  @IsOptional()
  orderPriceOffsetPct?: number;

  @ApiPropertyOptional({
    enum: IntervalModeEnum,
    example: IntervalModeEnum.AGENT,
  })
  @IsEnum(IntervalModeEnum)
  @IsOptional()
  intervalMode?: IntervalModeEnum;

  @ApiPropertyOptional({
    enum: RiskProfileEnum,
    example: RiskProfileEnum.MODERATE,
    description: 'Risk profile for model selection and prompts',
  })
  @IsEnum(RiskProfileEnum)
  @IsOptional()
  riskProfile?: RiskProfileEnum;

  @ApiPropertyOptional({
    example: false,
    description:
      'Interruptor maestro del corte de pérdida por señal. false = veto actual de minProfitPct intacto',
  })
  @IsBoolean()
  @IsOptional()
  lossCutEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 1,
    example: 0.85,
    description: 'Confianza mínima (0..1) del agente para habilitar la venta en pérdida',
  })
  @IsNumber({}, { message: 'Umbral de confianza de corte de pérdida debe ser un número válido' })
  @Min(0, { message: 'Umbral de confianza de corte de pérdida debe ser mayor o igual a $constraint1' })
  @Max(1, { message: 'Umbral de confianza de corte de pérdida no puede superar $constraint1' })
  @IsOptional()
  lossCutConfidenceThreshold?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 0.5,
    example: 0.005,
    description: 'Pérdida mínima (fracción) para considerar el corte de pérdida — evita churn por ruido',
  })
  @IsNumber({}, { message: 'Pérdida mínima de corte debe ser un número válido' })
  @Min(0, { message: 'Pérdida mínima de corte debe ser mayor o igual a $constraint1' })
  @Max(0.5, { message: 'Pérdida mínima de corte no puede superar $constraint1' })
  @IsOptional()
  lossCutMinLossPct?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    example: 2,
    description: 'Múltiplo de la fricción de salida que la pérdida evitada debe superar',
  })
  @IsNumber({}, { message: 'Ratio de borde de corte de pérdida debe ser un número válido' })
  @Min(0, { message: 'Ratio de borde de corte de pérdida debe ser mayor o igual a $constraint1' })
  @Max(100, { message: 'Ratio de borde de corte de pérdida no puede superar $constraint1' })
  @IsOptional()
  lossCutMinEdgeRatio?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'false = executeBuy usa calculateTradeQuantity sin modulación (factor 1, sin AEGIS ni FORGE)',
  })
  @IsBoolean()
  @IsOptional()
  smartSizingEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: 0.05,
    maximum: 1,
    example: 0.5,
    description: 'Factor aplicado cuando el verdict de AEGIS es REDUCE',
  })
  @IsNumber({}, { message: 'Factor de reducción de tamaño debe ser un número válido' })
  @Min(0.05, { message: 'Factor de reducción de tamaño debe ser al menos $constraint1' })
  @Max(1, { message: 'Factor de reducción de tamaño no puede superar $constraint1' })
  @IsOptional()
  reduceSizeFactor?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Coloca OCO real al abrir posición (solo LIVE/TESTNET; se ignora en SANDBOX)',
  })
  @IsBoolean()
  @IsOptional()
  nativeProtectionEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Opt-in agresivo: cerrar a mercado si la protección no se logra colocar tras los reintentos',
  })
  @IsBoolean()
  @IsOptional()
  closeOnProtectionFailure?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 0.05,
    example: 0.002,
    description:
      'Distancia entre el stopPrice y el price límite de la pierna STOP_LOSS_LIMIT',
  })
  @IsNumber({}, { message: 'Offset de stop-limit debe ser un número válido' })
  @Min(0, { message: 'Offset de stop-limit debe ser mayor o igual a $constraint1' })
  @Max(0.05, { message: 'Offset de stop-limit no puede superar $constraint1' })
  @IsOptional()
  stopLimitOffsetPct?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Activa el trailing stop. Mientras esté activo, el take-profit fijo queda desactivado',
  })
  @IsBoolean()
  @IsOptional()
  trailingStopEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: 0.001,
    maximum: 1,
    example: 0.02,
    description: 'Distancia del stop bajo el máximo visto (trailing)',
  })
  @IsNumber({}, { message: 'Porcentaje de trailing stop debe ser un número válido' })
  @Min(0.001, { message: 'Porcentaje de trailing stop debe ser al menos $constraint1' })
  @Max(1, { message: 'Porcentaje de trailing stop no puede superar $constraint1' })
  @IsOptional()
  trailingStopPct?: number;

  @ApiPropertyOptional({
    minimum: 0.001,
    maximum: 1,
    example: 0.01,
    description: 'Ganancia no realizada mínima para empezar a trailear',
  })
  @IsNumber({}, { message: 'Porcentaje de activación de trailing debe ser un número válido' })
  @Min(0.001, { message: 'Porcentaje de activación de trailing debe ser al menos $constraint1' })
  @Max(1, { message: 'Porcentaje de activación de trailing no puede superar $constraint1' })
  @IsOptional()
  trailingActivationPct?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Activa la venta parcial escalonada de take-profit',
  })
  @IsBoolean()
  @IsOptional()
  partialTpEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: 0.001,
    maximum: 1,
    example: 0.02,
    description: 'Ganancia que dispara la venta parcial',
  })
  @IsNumber({}, { message: 'Porcentaje de disparo de TP parcial debe ser un número válido' })
  @Min(0.001, { message: 'Porcentaje de disparo de TP parcial debe ser al menos $constraint1' })
  @Max(1, { message: 'Porcentaje de disparo de TP parcial no puede superar $constraint1' })
  @IsOptional()
  partialTpTriggerPct?: number;

  @ApiPropertyOptional({
    minimum: 0.05,
    maximum: 1,
    example: 0.5,
    description: 'Fracción de la posición que se vende en el TP parcial',
  })
  @IsNumber({}, { message: 'Porcentaje de venta de TP parcial debe ser un número válido' })
  @Min(0.05, { message: 'Porcentaje de venta de TP parcial debe ser al menos $constraint1' })
  @Max(1, { message: 'Porcentaje de venta de TP parcial no puede superar $constraint1' })
  @IsOptional()
  partialTpSellPct?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Tras el TP parcial, sube el stop a breakeven neto de fees',
  })
  @IsBoolean()
  @IsOptional()
  moveStopToBreakevenAfterPartial?: boolean;

  @ApiPropertyOptional({
    minimum: 5,
    maximum: 43200,
    example: 1440,
    description: 'Antigüedad máxima (minutos) de una posición antes de cerrarla por tiempo. null = desactivado',
  })
  @IsInt({ message: 'Máximo de minutos de posición abierta debe ser un entero' })
  @Min(5, { message: 'Máximo de minutos de posición abierta debe ser al menos $constraint1' })
  @Max(43200, { message: 'Máximo de minutos de posición abierta no puede superar $constraint1' })
  @IsOptional()
  maxPositionHoldMinutes?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Activa el gate determinista pre-LLM: si el mercado no muestra señal desde la última decisión, resuelve HOLD sin llamar al LLM',
  })
  @IsBoolean()
  @IsOptional()
  deterministicGateEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: 0.0005,
    maximum: 0.05,
    example: 0.005,
    description:
      'Umbral de cambio de precio del gate determinista (fracción). Por debajo, el gate nunca aplica; por encima, silencia movimientos relevantes',
  })
  @IsNumber({}, { message: 'Umbral de cambio de precio del gate debe ser un número válido' })
  @Min(0.0005, { message: 'Umbral de cambio de precio del gate debe ser al menos $constraint1 (0.05%)' })
  @Max(0.05, { message: 'Umbral de cambio de precio del gate no puede superar $constraint1 (5%)' })
  @IsOptional()
  gatePriceChangePct?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Interruptor maestro del ciclo reactivo. false = el bot solo actúa por el ciclo LLM periódico',
  })
  @IsBoolean()
  @IsOptional()
  reactiveLoopEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 60,
    example: 6,
    description: 'Cap de acciones por hora móvil del ciclo reactivo (por bot)',
  })
  @IsInt({ message: 'Máximo de acciones por hora debe ser un entero' })
  @Min(1, { message: 'Máximo de acciones por hora debe ser al menos $constraint1' })
  @Max(60, { message: 'Máximo de acciones por hora no puede superar $constraint1' })
  @IsOptional()
  maxActionsPerHour?: number;

  @ApiPropertyOptional({
    minimum: 5,
    maximum: 3600,
    example: 60,
    description: 'Tiempo mínimo en segundos entre acciones ejecutadas por el ciclo reactivo (por bot)',
  })
  @IsInt({ message: 'Intervalo mínimo entre acciones debe ser un entero' })
  @Min(5, { message: 'Intervalo mínimo entre acciones debe ser al menos $constraint1 segundos' })
  @Max(3600, { message: 'Intervalo mínimo entre acciones no puede superar $constraint1 segundos' })
  @IsOptional()
  minActionIntervalSec?: number;

  @ApiPropertyOptional({
    enum: EntryOrderModeEnum,
    example: EntryOrderModeEnum.MARKET,
    description:
      'Modo de la orden de entrada. MARKET = compra a mercado (comportamiento actual). ' +
      'LIMIT_MAKER = entrada descansando en el soporte. OCO = soporte + ruptura. ' +
      'Se ignora en modo SANDBOX.',
  })
  @IsEnum(EntryOrderModeEnum)
  @IsOptional()
  entryOrderMode?: EntryOrderModeEnum;

  @ApiPropertyOptional({
    minimum: 5,
    maximum: 1440,
    example: 120,
    description: 'Minutos desde placedAt tras los que una entrada sin fill vence y se cancela',
  })
  @IsInt({ message: 'TTL de la entrada debe ser un entero' })
  @Min(5, { message: 'TTL de la entrada debe ser al menos $constraint1 minutos' })
  @Max(1440, { message: 'TTL de la entrada no puede superar $constraint1 minutos (24hs)' })
  @IsOptional()
  entryOrderTtlMinutes?: number;

  @ApiPropertyOptional({
    minimum: 10,
    maximum: 2000,
    example: 100,
    description:
      'trailingDelta en BIPS de la pierna de ruptura del OCO de entrada (100 = 1%). ' +
      'Omitirlo deja la pierna en nivel fijo. El rango real lo fija el filtro TRAILING_DELTA del símbolo.',
  })
  @IsInt({ message: 'Trailing delta de entrada debe ser un entero en BIPS' })
  @Min(10, { message: 'Trailing delta de entrada debe ser al menos $constraint1 BIPS' })
  @Max(2000, { message: 'Trailing delta de entrada no puede superar $constraint1 BIPS' })
  @IsOptional()
  entryTrailingDeltaBips?: number;
}

export class StartAgentDto {
  @ApiProperty({ description: 'ID de la configuración del agente' })
  @IsString()
  configId!: string;
}

export class StopAgentDto {
  @ApiProperty({ description: 'ID de la configuración del agente' })
  @IsString()
  configId!: string;
}

export class StopAgentsByModeDto {
  @ApiProperty({
    enum: TradingModeEnum,
    description: 'Modo cuyos agentes se detendrán',
  })
  @IsEnum(TradingModeEnum)
  mode!: TradingModeEnum;
}

export class InitSandboxWalletDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 10_000_000, example: 10_000 })
  @IsNumber({}, { message: 'Capital USDT debe ser un número válido' })
  @Min(0, { message: 'Capital USDT debe ser mayor o igual a $constraint1' })
  @Max(10_000_000, { message: 'Capital USDT no puede superar $constraint1' })
  @IsOptional()
  capitalUsdt?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 10_000_000, example: 10_000 })
  @IsNumber({}, { message: 'Capital USDC debe ser un número válido' })
  @Min(0, { message: 'Capital USDC debe ser mayor o igual a $constraint1' })
  @Max(10_000_000, { message: 'Capital USDC no puede superar $constraint1' })
  @IsOptional()
  capitalUsdc?: number;
}

export class AutoNameAgentDto {
  @ApiProperty({ example: 'BTC' })
  @IsString()
  @MaxLength(20)
  asset!: string;

  @ApiPropertyOptional({ enum: RiskProfileEnum, example: RiskProfileEnum.MODERATE })
  @IsEnum(RiskProfileEnum)
  @IsOptional()
  riskProfile?: RiskProfileEnum;
}
