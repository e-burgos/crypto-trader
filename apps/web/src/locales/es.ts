const es = {
  nav: {
    dashboard: 'Panel',
    signIn: 'Ingresar',
    getStarted: 'Comenzar',
    signOut: 'Cerrar sesión',
    profile: 'Perfil',
    help: 'Docs',
    lightMode: 'Modo claro',
    darkMode: 'Modo oscuro',
  },
  sidebar: {
    overview: 'Resumen',
    liveChart: 'Gráfico en Vivo',
    tradeHistory: 'Historial',
    agentLog: 'Registro del Agente',
    analytics: 'Análisis',
    market: 'Mercado',
    botAnalysis: 'Análisis del Bot',
    config: 'Gestionar Agentes',
    settings: 'Ajustes',
    settingsProfile: 'Perfil',
    settingsExchange: 'Exchange',
    settingsLLMs: 'LLMs',
    settingsNews: 'Noticias',
    settingsAgents: 'Agentes IA',
    notifications: 'Notificaciones',
    positions: 'Posiciones',
    news: 'Análisis de Noticias',
    chat: 'KRYPTO IA',
    agents: 'Agentes',
    admin: 'Admin',
    help: 'Docs',
    groupTrading: 'Trading',
    groupAgente: 'Agentes',
    groupSettings: 'Ajustes',
    groupPlatform: 'Plataforma',
    // Admin sidebar
    adminGroupManagement: 'Administración',
    adminOverview: 'Vista General',
    adminUsers: 'Usuarios',
    adminAgents: 'Agentes',
    adminAuditLog: 'Registro de Auditoría',
    adminGroupConfig: 'Configuración',
    adminLLMProviders: 'Proveedores LLM',
    adminAgentModels: 'Modelos de Agentes',
    adminProfile: 'Perfil',
    adminGroupPlatform: 'Plataforma',
  },
  dashboard: {
    overview: 'Resumen',
    welcome: 'Bienvenido de vuelta',
    noData: 'Sin datos disponibles',
    portfolioOverview: 'Resumen del Portafolio',
    realtimeSummary: 'Resumen de rendimiento en tiempo real',
    realizedPnl: 'G/P Realizado',
    openPositions: 'Posiciones Abiertas',
    closedPositions: 'Posiciones cerradas',
    closedTotal: 'cerradas en total',
    tradingConfigsRunning: 'Configuraciones de trading en ejecución',
    noTradingData: 'Sin datos de trading todavía',
    configureAgent:
      'Configura un agente de trading para ver las estadísticas del portafolio.',
  },
  tradeHistory: {
    trades: '{{count}} trades',
    all: 'Todos',
    buys: 'Compras',
    sells: 'Ventas',
    live: 'En Vivo',
    paper: 'Paper',
    type: 'Tipo',
    pair: 'Par',
    price: 'Precio',
    qty: 'Cant.',
    total: 'Total',
    fee: 'Comisión',
    time: 'Hora',
    mode: 'Modo',
    detail: 'Ver Detalle',
    loading: 'Cargando trades...',
    noTrades:
      'Sin trades aún. Inicia un agente de trading para ver el historial.',
    modal: {
      title: 'Detalle del Trade',
      asset: 'Activo',
      executedAt: 'Ejecutado El',
      feeNote: '0.1% del total',
      feeExplain:
        'Comisión de ${{fee}} = 0.1% del valor del trade ${{total}}. Esta es la tarifa estándar de Binance (taker).',
      sectionPosition: 'Posición',
      sectionConfig: 'Configuración del Agente',
      entryPrice: 'Precio de Entrada',
      exitPrice: 'Precio de Salida',
      positionPnl: 'P&G de la Posición',
      positionFees: 'Comisiones Totales',
      positionStatus: 'Estado de la Posición',
      entryAt: 'Posición Abierta',
      exitAt: 'Posición Cerrada',
      stopLoss: 'Stop Loss',
      takeProfit: 'Take Profit',
      maxTrade: 'Máx. Trade %',
      buyThreshold: 'Umbral de Compra',
      sellThreshold: 'Umbral de Venta',
      minInterval: 'Intervalo Mínimo',
      priceOffset: 'Offset de Precio',
    },
  },
  agentLog: {
    subtitle: 'Razonamiento e historial de decisiones de la IA',
    decisions: '{{count}} decisiones',
    noDecisions: 'Sin decisiones del agente todavía',
    noDecisionsHint:
      'Inicia un agente de trading para ver el razonamiento y las decisiones de la IA aquí.',
    waitMinutes: 'Esperar: {{count}} min antes de la próxima acción',
    justification: 'Justificación',
    hideDetails: 'Ocultar detalles',
    showDetails: 'Ver snapshot de indicadores y noticias',
    marketSnapshot: 'Snapshot de mercado',
    newsProcessed: 'Noticias procesadas',
    decisionResult: 'Resultado de la decisión',
    confidence: 'Confianza',
    suggestedWait: 'Espera sugerida',
    generatedAt: 'Generada el',
    agent: 'Agente',
    mode: 'Modo',
    llmJustification: 'Justificación LLM',
    operationMode: 'Modo de operación',
    pair: 'Par',
    botName: 'Nombre del bot',
    configId: 'Config ID',
    botParameters: 'Parámetros del bot',
    buyThreshold: 'Umbral compra',
    sellThreshold: 'Umbral venta',
    stopLoss: 'Stop Loss',
    takeProfit: 'Take Profit',
    minProfit: 'Beneficio mínimo',
    maxCapital: 'Max. capital / operación',
    simultaneousPositions: 'Posiciones simultáneas',
    minInterval: 'Intervalo mínimo',
    intervalMode: 'Modo intervalo',
    priceOffset: 'Offset precio orden',
    status: 'Estado',
    active: 'Activo',
    stopped: 'Detenido',
    configCreated: 'Config creada',
    lastUpdated: 'Última actualización',
    activeLlmProvider: 'Proveedor LLM activo',
    provider: 'Proveedor',
    model: 'Modelo',
    processed: 'Procesada',
    configUsedInLastDecision: 'Config usada en última decisión',
    configUpdated: 'Config actualizada',
    noIndicators: 'Sin indicadores almacenados para la última decisión.',
    noNews: 'Sin noticias almacenadas para la última decisión.',
  },
  market: {
    title: 'Análisis de Mercado',
    subtitle:
      'Indicadores técnicos en tiempo real y señales de trading para los activos listados',
    autoRefresh: 'Auto-actualización · 60s',
    currentPrice: 'Precio Actual',
    score: 'Puntaje',
    updated: 'Actualizado',
    signal: 'Señal',
    histogram: 'Histograma',
    emaTrend: 'Cruce EMA y Tendencia',
    bollinger: 'Bandas de Bollinger',
    upper: 'Banda Superior',
    middle: 'Media (SMA20)',
    lower: 'Banda Inferior',
    bandwidth: 'Ancho de Banda',
    volume: 'Volumen',
    vsAvg: 'vs promedio',
    current: 'Actual',
    average: 'Promedio',
    supportResistance: 'Soporte / Resistencia',
    support: 'Soporte',
    resistance: 'Resistencia',
    signalReasons: 'Factores de la Señal',
    opportunity: {
      buyNow: 'COMPRAR AHORA',
      buyDetected: 'Oportunidad de entrada detectada',
      sellNow: 'VENDER AHORA',
      sellDetected: 'Presión bajista detectada',
      waitSignal: 'ESPERAR SEÑAL',
      noConfluence: 'Sin confluencia suficiente',
      confirmed: '{{pct}}% confirmado',
      bullish: '{{pct}}% alcista',
      bearish: '{{pct}}% bajista',
      signal: '{{pct}}% señal',
      confidence: 'Confianza',
      bullishSignal: 'Señal alcista',
      bearishSignal: 'Señal bajista',
      entry: 'Entrada',
      currentPrice: 'precio actual',
      riskReward: 'Riesgo/Beneficio',
      minRecommended: 'mínimo recomendado 1:1.5',
      indicatorChecklist: 'Checklist de indicadores',
      strong: 'fuerte',
      disclaimer:
        'Análisis técnico automático. No constituye asesoría financiera. El bot puede o no ejecutar esta señal dependiendo de su configuración de umbrales.',
    },
    refresh: 'Actualizar ahora',
    loadError: 'Error al cargar datos de mercado. Verifica tu conexión.',
    tabChart: 'Gráfico de Velas',
    tabAnalysis: 'Indicadores',
    chartTitle: 'Gráfico de Velas',
    chartSubtitle:
      'Gráfico de velas japonesas con indicadores técnicos superpuestos',
    modalWhat: '¿Qué es?',
    modalVisualization: 'Visualización',
    modalHow: '¿Cómo funciona?',
    modalSignals: 'Señales',
    modalClose: 'Cerrar',
    indicators: {
      price: {
        title: 'Precio Actual',
        subtitle: 'Precio de mercado en tiempo real + señal consolidada',
        what: 'Esta tarjeta muestra el precio actual del par seleccionado, obtenido en tiempo real via WebSocket desde el exchange. También calcula y muestra una señal consolidada (BUY, SELL, HOLD o NEUTRAL) basada en el agregado de todos los indicadores técnicos.',
        how: 'El precio se actualiza cada segundo desde el stream de mercado. La señal se deriva calculando un "score" ponderado de RSI, MACD, EMA, Bollinger Bands, Volumen y niveles de Soporte/Resistencia. Scores positivos apuntan a BUY, negativos a SELL, y cercanos a cero a NEUTRAL u HOLD.',
        tip: '💡 El agente de trading usa exactamente esta señal consolidada para decidir si ejecutar una orden. Un score cercano a 0 generará NEUTRAL — el agente no operará.',
        s0Label: 'BUY — Comprar',
        s0Desc:
          'Score consolidado positivo alto. La mayoría de indicadores sugieren condiciones alcistas.',
        s1Label: 'HOLD — Mantener',
        s1Desc:
          'Score moderado. Señales mixtas. El agente puede abrir posición con precaución.',
        s2Label: 'NEUTRAL',
        s2Desc:
          'Score cercano a cero. Los indicadores no tienen consenso claro. Se recomienda esperar.',
        s3Label: 'SELL — Vender',
        s3Desc:
          'Score consolidado negativo. La mayoría de indicadores sugieren condiciones bajistas.',
      },
      signalReasons: {
        title: 'Factores de la Señal',
        subtitle: 'Por qué el sistema emite BUY, SELL, HOLD o NEUTRAL',
        what: 'Los Factores de la Señal son los motivos individuales que cada indicador técnico aporta al score consolidado. Cada factor es una observación puntual: "RSI en zona oversold", "MACD cruce alcista", etc. Juntos forman el veredicto final.',
        how: 'El sistema evalúa RSI, MACD, EMA, Bollinger Bands, Volumen y Soporte/Resistencia. Cada uno aporta +1, -1 o 0 al score. Si el score supera el umbral positivo configurado → BUY; umbral negativo → SELL; cercano a 0 → NEUTRAL; moderado → HOLD.',
        tip: '💡 Si ves pocos factores o factores contradictorios (algunos alcistas y algunos bajistas), el mercado está en equilibrio. El agente usará NEUTRAL y no operará hasta tener más claridad.',
        s0Label: 'Factores alcistas',
        s0Desc:
          'Condiciones como RSI oversold, MACD cruce positivo, precio sobre EMA, volumen alto. Suman al score.',
        s1Label: 'Factores bajistas',
        s1Desc:
          'Condiciones como RSI overbought, MACD cruce negativo, precio bajo EMA, Bollinger sobre banda superior. Restan del score.',
        s2Label: 'Factores neutrales',
        s2Desc:
          'Indicadores sin señal clara (RSI en zona media, volumen normal). No suman ni restan.',
        s3Label: 'Score consolidado',
        s3Desc:
          'La suma de todos los factores. Visible como "Puntaje: +2" en la tarjeta de precio. Cuanto mayor el valor absoluto, más convicción tiene la señal.',
      },
      rsi: {
        title: 'RSI — Índice de Fuerza Relativa',
        subtitle: 'Relative Strength Index (14 períodos)',
        what: 'El RSI mide qué tan fuerte o débil se mueve un activo. Imagína un péndulo: si se fue demasiado hacia un lado, es probable que vuelva al centro.',
        how: 'Va de 0 a 100. Las zonas clave son 30 y 70. Cuando baja de 30, el mercado posiblemente exageró a la baja ("rebote probable"). Cuando sube de 70, posiblemente exageró al alza ("caída probable").',
        tip: '💡 El RSI funciona mejor en mercados laterales. En tendencias fuertes puede estar "overbought" durante mucho tiempo.',
        s0Label: '< 30 — OVERSOLD',
        s0Desc: 'El precio cayó mucho. Posible oportunidad de compra.',
        s1Label: '30–70 — NEUTRAL',
        s1Desc: 'Zona de equilibrio, sin señal clara.',
        s2Label: '> 70 — OVERBOUGHT',
        s2Desc: 'El precio subió demasiado. Posible corrección.',
      },
      macd: {
        title: 'MACD — Convergencia/Divergencia de Medias',
        subtitle: 'Moving Average Convergence Divergence (12, 26, 9)',
        what: 'El MACD compara dos medias móviles para detectar cambios de tendencia. Es como medir si el motor del precio está acelerando o frenando.',
        how: 'Tiene 3 componentes: la línea MACD (rápida), la línea de Señal (lenta) y el Histograma (diferencia). Cuando la línea MACD cruza por encima de la Señal → momento alcista. Cuando cruza por debajo → momento bajista.',
        tip: '💡 El MACD es un indicador retrasado, confirma tendencias. Úsalo junto con el RSI para señales más confiables.',
        s0Label: 'BULLISH',
        s0Desc: 'MACD cruzó por encima de la Señal. Momentum positivo.',
        s1Label: 'BEARISH',
        s1Desc: 'MACD cruzó por debajo de la Señal. Momentum negativo.',
        s2Label: 'Histograma +',
        s2Desc: 'Barras verdes: el momentum alcista se fortalece.',
        s3Label: 'Histograma -',
        s3Desc: 'Barras rojas: el momentum bajista se fortalece.',
      },
      ema: {
        title: 'Cruce de EMAs — Tendencia de Medias Móviles',
        subtitle: 'Exponential Moving Averages (9, 21, 200)',
        what: 'Las EMAs son promedios del precio que dan más peso a los datos recientes. Son como la "temperatura promedio" del mercado en diferentes períodos de tiempo.',
        how: 'Cuando la EMA rápida (9) cruza por encima de la lenta (21) es una señal alcista ("Golden Cross" mini). Cuando el precio está sobre la EMA 200, la tendencia a largo plazo es alcista.',
        tip: '💡 La EMA 200 es la más importante para traders a largo plazo. Muchos fondos compran cuando el precio está por encima de ella.',
        s0Label: 'BULLISH',
        s0Desc: 'EMA 9 > EMA 21 y precio sobre EMAs. Tendencia al alza.',
        s1Label: 'BEARISH',
        s1Desc: 'EMA 9 < EMA 21. El precio está cayendo en promedio.',
        s2Label: 'ABOVE EMA 200',
        s2Desc: 'Tendencia a largo plazo alcista. Mercado "sano".',
        s3Label: 'BELOW EMA 200',
        s3Desc: 'Tendencia a largo plazo bajista. Precaución.',
      },
      bollinger: {
        title: 'Bandas de Bollinger',
        subtitle: 'Volatilidad del mercado (SMA 20 ± 2σ)',
        what: 'Las Bandas de Bollinger son como un "carril" dinámico para el precio. Se expanden cuando el mercado es volátil y se contraen cuando está tranquilo.',
        how: 'Hay 3 líneas: media central (SMA 20) y dos bandas a 2 desviaciones estándar. El precio suele mantenerse dentro de las bandas el ~95% del tiempo. Tocar la banda es una advertencia, salirse es una señal.',
        tip: '💡 Las bandas estrechas (squeeze) son la señal más poderosa: el mercado está acumulando energía para un gran movimiento.',
        s0Label: 'ABOVE — Sobre banda superior',
        s0Desc:
          'El precio rompió el techo. Posible sobrecompra o inicio de breakout.',
        s1Label: 'BELOW — Bajo banda inferior',
        s1Desc:
          'El precio tocó el suelo. Posible sobreventa o inicio de caída.',
        s2Label: 'WIDE — Bandas anchas',
        s2Desc: 'Alta volatilidad. Movimientos bruscos probables.',
        s3Label: 'NARROW — Bandas estrechas',
        s3Desc: '"Squeeze" o compresión. Suele preceder un movimiento grande.',
      },
      volume: {
        title: 'Volumen de Operaciones',
        subtitle: 'Cantidad de activo negociado (vs. promedio)',
        what: 'El volumen muestra cuántas personas están comprando o vendiendo. Es la "convicción" detrás de un movimiento de precio. Sin volumen, los movimientos no son sostenibles.',
        how: 'Se compara el volumen actual con el promedio de los últimos períodos. Un volumen 2x el promedio con precio al alza confirma la tendencia. Un volumen muy bajo sugiere que el movimiento puede revertirse.',
        tip: '💡 Regla de oro: el volumen precede al precio. Si el precio sube pero el volumen cae, la tendencia está perdiendo fuerza.',
        s0Label: 'HIGH — Volumen alto',
        s0Desc: 'Ratio > 1.5x. Movimiento con fuerte convicción del mercado.',
        s1Label: 'NORMAL — Volumen normal',
        s1Desc: 'Ratio ~ 1x. Actividad habitual, sin señal especial.',
        s2Label: 'LOW — Volumen bajo',
        s2Desc:
          'Ratio < 0.7x. Poco interés. Posible consolidación o reversión.',
      },
      opportunity: {
        title: 'Panel de Oportunidad',
        subtitle: 'Señal de acción + confianza + niveles de precio sugeridos',
        what: 'Esta tarjeta resume todo el análisis técnico en una sola acción sugerida: COMPRAR, VENDER o ESPERAR SEÑAL. Incluye el porcentaje de confianza, los niveles de entrada, stop loss y take profit calculados automáticamente, y la lista de checks de indicadores que determinaron la decisión.',
        how: 'El sistema evalúa 5 checks (RSI, MACD, EMA, Bollinger, Volumen) con pesos distintos: indicadores fuertes cuentan ×2, medios ×1. La confianza se calcula como el porcentaje del peso total que aprueba. La acción depende del score consolidado: ≥ 4 → COMPRAR, ≤ -4 → VENDER, entre -4 y +4 → ESPERAR. Los niveles de precio usan el soporte/resistencia más cercano o un % fijo como fallback.',
        tip: '💡 El % de confianza y el estado de acción son independientes. Puedes ver 71% alcista con ESPERAR porque el score (+1 ó +2) no llegó a 4. Para cambiar de ESPERAR a COMPRAR el MACD necesita cruzar al alza (sum +3 de golpe) o acumularse entre RSI, EMA y Bollinger.',
        s0Label: 'COMPRAR — score ≥ 4',
        s0Desc:
          'Fuerte confluencia alcista. RSI no sobrecomprado, MACD positivo, EMA alineada al alza. El agente puede ejecutar una orden de compra si supera el umbral configurado.',
        s1Label: 'VENDER — score ≤ -4',
        s1Desc:
          'Fuerte confluencia bajista. Los indicadores apuntan a presión vendedora. El agente puede cerrar posición o abrir corto si está habilitado.',
        s2Label: 'ESPERAR SEÑAL — score entre -3 y +3',
        s2Desc:
          'No hay confluencia suficiente. Los indicadores están divididos o son débiles. El agente no opera hasta que el score supere los umbrales.',
        s3Label: '% Confianza',
        s3Desc:
          'Porcentaje de peso de checks que pasan. Un 71% alcista con estado ESPERAR significa que los checks individuales favorecen la compra, pero el score agregado aún no alcansa el umbral de ≥ 4 para activar la señal.',
      },
      chart: {
        title: 'Gráfico de Velas',
        subtitle:
          'Gráfico de velas japonesas con indicadores técnicos superpuestos',
        what: 'El gráfico de velas muestra el movimiento del precio a lo largo del tiempo. Cada vela representa un período (1m, 5m, 1h, etc.) mostrando su apertura, cierre, máximo y mínimo. Los indicadores técnicos calculados por el sistema se pueden activar como capas sobre las velas.',
        how: 'Los datos OHLCV (Apertura, Máximo, Mínimo, Cierre, Volumen) se obtienen del exchange vía API. El stream en tiempo real actualiza la vela actual cada segundo por WebSocket. Los indicadores superpuestos son líneas de precio derivadas del snapshot de indicadores y se refrescan automáticamente cada 60 segundos.',
        tip: '💡 Los indicadores superpuestos muestran el valor puntual actual de cada indicador (snapshot), no la curva histórica. Graficar la curva histórica completa requeriría calcular el indicador sobre todas las velas — disponible como Opción B en el roadmap.',
        s0Label: 'EMA 9 / 21',
        s0Desc:
          'Medias móviles exponenciales de corto plazo. Cuando la EMA 9 cruza por encima de la EMA 21 es una señal alcista. Se muestran como líneas horizontales en el precio calculado actual.',
        s1Label: 'EMA 200',
        s1Desc:
          'Media móvil de largo plazo. Actúa como soporte o resistencia macro. Precio por encima de la EMA 200 = tendencia alcista estructural.',
        s2Label: 'Bandas de Bollinger',
        s2Desc:
          'Tres bandas (superior, media, inferior) que encierran el rango estadístico del precio. El precio tocando la banda inferior puede señalar sobreventa; la superior, sobrecompra.',
        s3Label: 'S/R — Soporte y Resistencia',
        s3Desc:
          'Niveles clave de precio detectados automáticamente. Las líneas rojas son resistencias (techos) y las verdes son soportes (pisos). Activo por defecto por ser la capa más informativa.',
      },
      supportResistance: {
        title: 'Soporte y Resistencia',
        subtitle: 'Niveles clave de precio detectados automáticamente',
        what: 'Los soportes y resistencias son zonas de precio donde históricamente el mercado "rebota". El soporte es como el suelo y la resistencia como el techo.',
        how: 'Se identifican buscando niveles donde el precio se detuvo varias veces. Si el precio rompe una resistencia, ésta puede convertirse en nuevo soporte. Si rompe un soporte, puede convertirse en resistencia.',
        tip: '💡 Cuantas más veces el precio toca un nivel sin romperlo, más fuerte es ese nivel. Un nivel "probado" múltiples veces es muy significativo.',
        s0Label: 'Resistencia',
        s0Desc:
          'Nivel por encima donde vendedores toman control. El precio tiende a bajar desde ahí.',
        s1Label: 'Soporte',
        s1Desc:
          'Nivel por debajo donde compradores toman control. El precio tiende a rebotar desde ahí.',
        s2Label: '% distancia',
        s2Desc:
          'Qué tan lejos está el nivel del precio actual. Más cerca = más relevante ahora.',
      },
    },
  },
  liveChart: {
    loading: 'Cargando velas...',
  },
  news: {
    subtitle: 'Últimas noticias del mercado cripto',
    all: 'Todos',
    positive: 'Positivo',
    negative: 'Negativo',
    neutral: 'Neutral',
    apiKeyRequired:
      'Cargando noticias de fuentes gratuitas: CoinGecko, CoinDesk, CoinTelegraph, Reddit.',
    llmConfig: 'Modelo de IA para Análisis',
    primaryProvider: 'Primario',
    fallbackProvider: 'Secundario (fallback)',
    selectProvider: 'Seleccionar proveedor',
    selectModel: 'Seleccionar modelo',
    noProviders: 'Sin proveedores configurados',
    autoSuggestion:
      'Sin configurar — el sistema elegirá automáticamente del ranking global',
    openInNewTab: 'Abrir en nueva pestaña',
    sentimentSummary: 'Resumen de Sentimiento',
    aiActive: 'IA activa',
    bullish: 'Alcista',
    bearish: 'Bajista',
    lastAiAnalysis: 'Último análisis IA',
    lastSigmaAnalysis: 'Último análisis SIGMA',
    lastKeywordAnalysis: 'Último análisis Keyword',
    positiveCount: '{{count}} positivas',
    neutralCount: '{{count}} neutrales',
    negativeCount: '{{count}} negativas',
    newsAnalyzed: '{{count}} noticias analizadas',
    keywordSummary:
      '{{positive}} positivas, {{negative}} negativas, {{neutral}} neutrales — score {{score}} sobre {{total}} noticias. Sentimiento general: {{overall}}. Análisis keyword-based sobre titulares y resúmenes.',
    noAnalysis: 'No hay análisis guardado aún.',
    generateAnalysis: 'Generar análisis',
    keywordAnalysis: 'Análisis Keyword',
    aiAnalysis: 'Análisis IA',
    updateAiAnalysis: 'Actualizar Análisis IA',
    analyzing: 'Analizando…',
    configureAiAnalysis: 'Configurar Análisis IA',
    configure: 'Configurar',
    aiReclassifications: '{{count}} reclasificaciones por IA',
    sigmaReclassifications: '{{count}} reclasificaciones SIGMA vs Keyword',
    aiAnalysisComplete: 'Análisis IA completado y guardado',
    aiAnalysisError: 'Error al analizar',
    keywordAnalysisComplete: 'Análisis keyword actualizado',
    keywordAnalysisError: 'Error al actualizar el análisis',
    configTitle: 'Configuración de Noticias',
    analysisInterval: 'Intervalo de análisis (min)',
    newsCount: 'Cantidad de noticias',
    botAnalyzesNews: 'Incluir noticias en las decisiones',
    botAnalyzesNewsDesc:
      'Cuando está activo, SIGMA analiza el sentimiento de noticias como parte del ciclo de decisión. Si se desactiva, el agente decide solo con indicadores técnicos.',
    newsWeight: 'Peso de noticias en la decisión',
    newsWeightDesc:
      'Porcentaje de influencia del sentimiento sobre los indicadores técnicos',
    weightTechnicalOnly: '0% (solo técnicos)',
    weightBalanced: '50% (equilibrado)',
    weightNewsOnly: '100% (solo noticias)',
    onlySummary: 'Solo noticias con resumen',
    onlySummaryDesc: 'Excluye noticias sin contenido (recomendado)',
    enabledSources: 'Fuentes habilitadas (todas = vacío)',
    saveConfig: 'Guardar configuración',
    llmConfigNote:
      'El modelo IA para análisis de noticias lo gestiona el agente SIGMA. Puedes configurarlo en Configuración → Agentes.',
  },
  admin: {
    title: 'Panel de Administración',
    tabStats: 'Estadísticas y Resumen',
    tabUsers: 'Usuarios',
    tabAgents: 'Agentes IA',
    totalUsers: 'Total de Usuarios',
    openPositions: 'Posiciones Abiertas',
    tradesToday: 'Trades Hoy',
    pnlToday: 'G/P Hoy',
    killSwitch: 'Kill Switch de Emergencia',
    killSwitchDesc:
      'Detiene inmediatamente todos los agentes de trading en ejecución de todos los usuarios. No se puede deshacer sin reiniciar manualmente cada agente.',
    confirmStopAll: 'CONFIRMAR DETENER TODO',
    killAllAgents: 'Detener Todos los Agentes',
    activeAgentsPlatform: 'Agentes Activos en la Plataforma',
    auditLog: 'Registro de Auditoría',
    auditLogNote: '(últimas 50 acciones)',
    noAuditEntries: 'Sin entradas de auditoría',
    registeredUsers: '{{count}} usuarios registrados',
    activate: 'Activar',
    deactivate: 'Desactivar',
    agentRunning: '● En ejecución',
    agentStopped: '○ Detenido',
    // Agent table columns
    agentColPair: 'Par',
    agentColName: 'Nombre de Config',
    agentColUser: 'Usuario',
    agentColMode: 'Modo',
    agentColStatus: 'Estado',
    agentColUpdated: 'Última Actualización',
    noActiveAgents: 'No hay agentes en ejecución en este momento',
    agentPageInfo: 'Mostrando {{from}}-{{to}} de {{total}} agentes',
    docPending: 'Pendiente',
    docProcessing: 'Procesando',
    docReady: 'Listo',
    docError: 'Error',
    // Overview page
    overviewTitle: 'Vista General de la Plataforma',
    overviewSubtitle: 'Métricas y actividad en tiempo real de la plataforma',
    // Users page
    usersTitle: 'Gestión de Usuarios',
    usersSubtitle: 'Ver y gestionar los usuarios registrados en la plataforma',
    // Agents page
    agentsPageTitle: 'Gestión de Agentes',
    agentsPageSubtitle:
      'Monitorea y gestiona todos los agentes de trading en la plataforma',
    // Profile page
    profileTitle: 'Perfil de Administrador',
    profileSubtitle: 'Gestiona la configuración de tu cuenta de administrador',
    accountInfo: 'Información de la Cuenta',
    memberSince: 'Miembro desde',
    // Notifications
    notificationsSubtitle: 'Notificaciones y alertas de la plataforma',
    // LLM Management
    llmTitle: 'Gestión de Proveedores LLM',
    llmSubtitle:
      'Configura los modelos de IA por defecto y monitorea la disponibilidad de proveedores en la plataforma',
    llmProviderStatus: 'Disponibilidad de Proveedores',
    // Provider Toggle (Spec 38)
    providerStatusTitle: 'Estado de Proveedores',
    providerStatusSubtitle:
      'Habilita o deshabilita proveedores LLM a nivel de plataforma. Deshabilitar un proveedor elimina todas las configuraciones de agentes que lo usen.',
    providerActive: 'Activo',
    providerInactive: 'Deshabilitado',
    providerToggleConfirmTitle: '¿Deshabilitar Proveedor?',
    providerToggleConfirmDesc:
      'Deshabilitar {{provider}} eliminará todas las configuraciones de agentes que usen este proveedor. Los usuarios afectados serán notificados.',
    providerToggleConfirmAction: 'Deshabilitar Proveedor',
    providerToggleSuccess: '{{provider}} ahora está {{state}}',
    llmDefaultModels: 'Modelos por Defecto de Agentes',
    llmDefaultModelsDesc:
      'Establece el proveedor y modelo por defecto para cada agente de IA. Los usuarios pueden sobreescribir esto con su propia configuración.',
    agentModelsTitle: 'Modelos por Defecto de Agentes',
    agentModelsSubtitle:
      'Establece el proveedor y modelo por defecto para cada agente de IA. Los usuarios pueden sobreescribir esto con su propia configuración.',
    fallbackDescription:
      'Modelo de respaldo por defecto usado a nivel de plataforma cuando un usuario no tiene configuración personalizada. Se aplica automáticamente con los presets.',
    // Audit Log
    auditLogTitle: 'Registro de Auditoría',
    auditLogSubtitle:
      'Historial completo de acciones administrativas en la plataforma',
    auditLogEntries: '{{count}} entradas',
    auditAction: 'Acción',
    auditTarget: 'Objetivo',
    auditAdmin: 'Administrador',
    auditDate: 'Fecha',
    auditPageInfo: 'Mostrando {{from}}-{{to}} de {{total}} entradas',
    // Help
    helpTitle: 'Ayuda del Administrador',
    helpSubtitle: 'Referencia rápida para la administración de la plataforma',
    helpDashboard: 'Dashboard',
    helpDashboardDesc:
      'Visualiza estadísticas de la plataforma, agentes activos y usa el kill switch de emergencia.',
    helpUsers: 'Gestión de Usuarios',
    helpUsersDesc:
      'Activa o desactiva cuentas de usuario. Consulta fechas de registro y roles.',
    helpAgents: 'Gestión de Agentes',
    helpAgentsDesc:
      'Monitorea el estado de los agentes IA, sube documentos y configura modelos.',
    helpLLMs: 'Proveedores LLM',
    helpLLMsDesc:
      'Configura claves API y monitorea la disponibilidad de proveedores en la plataforma.',
    helpAgentModels: 'Modelos de Agentes',
    helpAgentModelsDesc:
      'Establece modelos de IA por defecto por agente. Los usuarios pueden sobreescribir con su propia configuración.',
    helpAuditLog: 'Registro de Auditoría',
    helpAuditLogDesc:
      'Revisa todas las acciones administrativas con marcas de tiempo y detalles.',
    helpKillSwitch: 'Kill Switch',
    helpKillSwitchDesc:
      'Parada de emergencia para todos los agentes de trading de todos los usuarios. Usar con precaución.',
    helpGeneral: 'Documentación de la Plataforma',
    helpGeneralDesc:
      'Para documentación detallada sobre la plataforma de trading, comportamiento de agentes y conceptos de configuración, visita la guía completa.',
    helpGoToGuide: 'Ir a Ayuda y Guía',
    // User table columns
    userColEmail: 'Email',
    userColRole: 'Rol',
    userColStatus: 'Estado',
    userColConfigs: 'Configs',
    userColPositions: 'Posiciones',
    userColJoined: 'Registro',
    userColMode: 'Modo',
    noUsers: 'No se encontraron usuarios',
    // User detail modal
    userDetailDesc:
      'Resumen de la cuenta del usuario y estadísticas de trading',
    userStats: 'Estadísticas de Trading',
    userNetPnl: 'G/P Neto',
    userOpenPos: 'Posiciones Abiertas',
    userClosedPos: 'Posiciones Cerradas',
    userTotalTrades: 'Total de Trades',
    userLlmCosts: 'Costos de LLM',
    userLlmTotalCost: 'Costo Total',
    userLlmTokens: 'Total de Tokens',
    userLlmCalls: 'Llamadas a API',
    userAgents: 'Configuraciones de Agentes',
    userNoAgents: 'Sin configuraciones de agentes',
    // LLM Management extras
    llmNoKeyTitle: 'Sin clave API configurada',
    llmNoKeyDesc:
      'Configura al menos una clave API de proveedor LLM para ver los modelos disponibles y gestionar los valores por defecto.',
    llmApiKeys: 'Claves API',
  },
  connections: {
    title: 'Estado de Conexiones',
    refresh: 'Actualizar',
    manageKeys: 'Gestionar claves API',
    internet: 'Internet',
    internetSub: 'Conectividad de red del navegador',
    api: 'Servidor API',
    apiSub: 'Backend de la plataforma',
    binanceLive: 'Binance Live',
    binanceLiveSub: 'Claves API de trading real',
    binanceTestnet: 'Binance Testnet',
    binanceTestnetSub: 'Claves API de testnet',
    llm: 'Proveedor LLM',
    llmProviders: 'Proveedores LLM',
    llmSub: 'Sin proveedor configurado',
    llmConnectedCount: '{{count}} conectado(s)',
    statusOk: 'Todo OK',
    statusWarning: 'Atención',
    statusError: 'Con errores',
    statusLoading: 'Verificando...',
    connOk: 'Conectado',
    connWarning: 'Sin clave',
    connError: 'Error',
    connLoading: '...',
  },
  trading: {
    startAgent: 'Iniciar Agente',
    stopAgent: 'Detener Agente',
    sandbox: 'Sandbox',
    live: 'En Vivo',
    asset: 'Activo',
    pair: 'Par',
    mode: 'Modo',
    market: 'Mercado',
    configSubtitle: 'Configura los parámetros de tu agente de trading con IA',
    decisionThresholds: 'Umbrales de Decisión',
    riskManagement: 'Gestión de Riesgo',
    timing: 'Tiempos',
    realFundsWarning: '⚠️ Se usarán fondos reales',
    testnetRealOrders: 'Binance Testnet · órdenes reales en entorno de prueba',
    intervalModeAgent: 'Decisión del Agente',
    intervalModeCustom: 'Intervalo personalizado',
    intervalModeAgentHint:
      'El agente usará el tiempo de espera sugerido por la IA entre ciclos.',
    buyThreshold: 'Umbral de Compra',
    sellThreshold: 'Umbral de Venta',
    minProfit: 'Ganancia Mínima para Venta (%)',
    stopLoss: 'Stop Loss %',
    takeProfit: 'Take Profit %',
    maxTrade: 'Máx. Trade %',
    maxConcurrent: 'Posiciones Concurrentes Máx.',
    minInterval: 'Intervalo Mínimo (min)',
    saveConfig: 'Guardar Configuración',
    createConfig: 'Crear Configuración',
    agentName: 'Nombre del Agente',
    agentNamePlaceholder: 'ej: BTC Agresivo',
    autoName: 'Auto',
    riskProfile: 'Perfil de Riesgo',
    riskConservative: 'Conservador',
    riskConservativeDesc: 'Menor frecuencia, modelos premium',
    riskModerate: 'Moderado',
    riskModerateDesc: 'Balance entre costo y calidad',
    riskAggressive: 'Agresivo',
    riskAggressiveDesc: 'Mayor frecuencia, acepta más riesgo',
    llmConfig: 'Modelo de IA del Agente',
    primaryLLM: 'Primario',
    fallbackLLM: 'Secundario (fallback)',
    deleteConfig: 'Eliminar Configuración',
    confirmDelete:
      '¿Eliminar este agente y su configuración? Esta acción no se puede deshacer.',
    activeAgents: 'Agentes Activos',
    noConfigs: 'Sin configuraciones de trading',
    configSaved: 'Configuración guardada',
    agentStarted: 'Agente iniciado',
    agentStopped: 'Agente detenido',
    orderExecution: 'Ejecución de Órdenes',
    orderExecutionSub:
      'Configura el precio al que se generan las órdenes de compra respecto al precio de mercado',
    orderPriceOffset: 'Offset de Precio',
    offsetNegative: '-% (Favorable)',
    offsetNegativeDesc:
      'Compra por debajo del mercado — mejor precio en simulación',
    offsetZero: 'Mercado',
    offsetZeroDesc: 'Ejecuta al precio de mercado actual',
    offsetPositive: '+% (Agresivo)',
    offsetPositiveDesc: 'Compra por encima — ejecución más rápida',
  },
  analytics: {
    title: 'Análisis',
    subtitle: 'Métricas de rendimiento y estadísticas',
    netPnl: 'G/P Neto',
    totalTrades: 'Total de Trades',
    winRate: 'Tasa de Éxito',
    winRateSub: 'Trades rentables vs total',
    totalVolume: 'Volumen Total',
    totalFees: 'Comisiones Totales',
    activeConfigs: 'Configs Activas',
    sharpeRatio: 'Ratio de Sharpe',
    sharpeRatioSub: 'Rendimiento ajustado al riesgo',
    drawdown: 'Drawdown',
    drawdownSub: 'Desde el valor máximo del portafolio',
    bestTrade: 'Mejor Trade',
    worstTrade: 'Peor Trade',
    pnlChart: 'G/P en el Tiempo',
    assetBreakdown: 'Desglose por Activo',
    last30Days: 'Últimos 30 días',
    open: 'abiertas',
    runningAgentsSub: 'Agentes de trading en ejecución',
    noPnlData: 'Sin datos de G/P aún',
  },
  settings: {
    title: 'Ajustes',
    subtitle: 'Administra tu perfil y claves API',
    profileSubtitle: 'Administra las credenciales de tu cuenta',
    exchangeSubtitle: 'Configura tus claves API de Binance para operar',
    llmsTitle: 'LLMs',
    llmsSubtitle: 'Configura proveedores de modelos IA y claves API',
    llms: {
      noKeyBannerTitle: 'Se requiere una clave API',
      noKeyBannerDesc:
        'Necesitas configurar al menos una clave API activa para acceder a la plataforma. Agrega tu clave de OpenRouter y prueba la conexión.',
      providerDisabledByAdmin: 'Deshabilitado por el administrador',
      providerDisabledOverlay:
        'Este proveedor ha sido deshabilitado por el administrador de la plataforma.',
    },
    newsSubtitle: 'Configura fuentes de noticias y claves API',
    newsSubTabs: {
      config: 'Configuración de Noticias',
      sources: 'Fuentes de Noticias',
    },
    newsConfigSaved: 'Configuración guardada',
    newsConfigError: 'Error al guardar configuración',
    tabProfile: 'Perfil',
    tabExchange: 'Exchange',
    tabAiModels: 'Modelos IA',
    tabNews: 'Noticias',
    profile: 'Perfil',
    email: 'Correo electrónico',
    password: 'Nueva Contraseña',
    saveProfile: 'Guardar Perfil',
    binanceKeys: 'Claves API de Binance',
    binanceTestnetKeys: 'Claves API de Binance Testnet',
    binanceTestnetApiKey: 'API Key de Binance Testnet',
    binanceTestnetApiSecret: 'API Secret de Binance Testnet',
    binanceTestnetTip:
      'Obtén tus claves testnet gratis en testnet.binance.vision. No tienen valor real.',
    apiKey: 'Clave API',
    apiSecret: 'Secreto API',
    saveKeys: 'Guardar Claves',
    disconnectBinance: 'Desconectar',
    connected: 'Conectado',
    disconnected: 'No conectado',
    llmKeys: 'Claves API de LLM',
    aiSubTabs: {
      apiKeys: 'Claves API',
      primary: 'Proveedor Principal',
      providers: 'Otros Proveedores',
      analytics: 'Analíticas de Proveedores',
    },
    activateProviderFirst: 'Guarda tu clave API para seleccionar un modelo',
    openrouter: {
      recommended: 'Recomendado',
      subtitle:
        'Una sola API key para acceder a todos los modelos: Claude, GPT, Gemini, Llama, Mistral y más.',
      benefit1: '+200 modelos de todos los proveedores principales',
      benefit2: 'Fallback automático si un modelo falla',
      benefit3: 'Facturación unificada en todos los proveedores',
      benefit4: 'Sin necesidad de gestionar múltiples cuentas',
      primaryModel: 'Modelo Principal',
      fallbackModel: 'Modelo de Respaldo',
      fallbackModelNote:
        'Este modelo se usa solo cuando un agente no tiene configuración específica. Los agentes resuelven su propio LLM via Agent Hub Config.',
      bannerHint:
        'Con OpenRouter puedes acceder a todos estos proveedores con una sola API key.',
      configureCta: 'Configurar OpenRouter',
      directProvidersNote:
        'También puedes configurar proveedores individuales con sus propias claves API en la pestaña "Otros Proveedores" si prefieres acceso directo.',
    },
    orCategory: {
      topPaid: 'Top 10 Pagos',
      free: 'Ranking Gratuitos',
      all: 'Todos los Modelos',
      reasoning: 'Razonamiento',
      fast: 'Rápidos y Baratos',
      toolUse: 'Uso de Herramientas',
      longContext: 'Contexto Largo (200K+)',
      premium: 'Premium',
      allCategories: 'Todas las Categorías',
    },
    orPrice: {
      all: 'Todos',
      free: 'Solo Gratis',
      paid: 'Solo Pagos',
    },
    orSort: {
      smart: 'Ranking Inteligente',
      cheapest: 'Más Baratos',
      mostCapable: 'Más Capaces',
      longestContext: 'Mayor Contexto',
    },
    orFilter: {
      category: 'Categoría',
      price: 'Precio',
      sort: 'Ordenar',
      modelsAvailable: 'modelos disponibles',
    },
    modelInfo: {
      viewDetails: 'Ver detalles del modelo',
    },
    provider: 'Proveedor',
    model: 'Modelo',
    remove: 'Eliminar',
    active: 'Activo',
    inactive: 'Inactivo',
    invalid: 'Inválido',
    disabledByAdmin: 'Deshabilitado',
    providerDisabledNotice:
      'Este proveedor fue desactivado temporalmente por el administrador, para conocer más detalles ponte en contacto con nosotros.',
    newsSources: 'Fuentes de Noticias',
    freeSource: 'Gratis · Sin clave API requerida',
    reachable: 'Alcanzable',
    unreachable: 'No alcanzable',
    checkAll: 'Verificar Conectividad',
    checking: 'Verificando…',
    noKeyNeeded:
      'Todas las fuentes de noticias son gratuitas y no requieren clave API.',
    optionalSource: 'Opcional · Requiere clave API gratuita',
    notConfigured: 'No configurado',
    getApiKeyAt: 'Obtén tu clave API gratuita en',
    saveKey: 'Guardar',
    removeKey: 'Eliminar',
    disconnectProvider: 'Desconectar',
    testConnection: 'Probar',
    testSuccess: 'Conectado ✔',
    testFailed: 'Fallo de conexión',
    testing: 'Probando…',
    validating: 'Validando…',
    revalidate: 'Re-validar',
    available: 'disponibles',
    autoValidationFailed: 'Validación automática falló',
    aiUsage: 'Uso de IA y Costos',
    noUsageData:
      'Sin datos de uso aún. Usa las funciones de IA para ver estadísticas aquí.',
    totalCost: 'Costo Total',
    requests: 'Solicitudes',
    inputTokens: 'Tokens de Entrada',
    outputTokens: 'Tokens de Salida',
    tokensLabel: 'Tokens',
    cost: 'Costo',
    dailyCosts: 'Costos Diarios',
    providerDistribution: 'Distribución por Proveedor',
    tokensByProvider: 'Tokens por Proveedor',
    costByProvider: 'Costo por Proveedor',
    agents: {
      title: 'Configuración de Agentes IA',
      description:
        'Asigna proveedor y modelo LLM a cada agente. Las decisiones de trading usan los modelos configurados aquí.',
      provider: 'Proveedor',
      model: 'Modelo',
      usingOverride: 'Personalizado',
      usingAdmin: 'Default Admin',
      usingDefault: 'Default Sistema',
      resetToDefault: 'Restablecer',
      saved: 'Configuración de agente guardada',
      resetSuccess: 'Configuración restaurada al default',
      healthWarning:
        'Algunos agentes no tienen una clave API activa para su proveedor configurado.',
      orchestrator: 'Orquestador',
      specialists: 'Agentes Especialistas',
      riskManager: 'Gestor de Riesgo',
      presets: {
        title: 'Configuración rápida',
        description:
          'Aplica un set de modelos preconfigurados a todos los agentes de una sola vez.',
        free: 'Set Gratuito',
        freeDesc: 'Solo modelos gratuitos de OpenRouter (sin costo)',
        optimized: 'Set Optimizado',
        optimizedDesc: 'Los mejores modelos de pago para cada rol',
        balanced: 'Set Equilibrado',
        balancedDesc: 'Mix óptimo calidad/costo (gratuitos + pago)',
        applied: 'Preset "{{name}}" aplicado a todos los agentes',
        applying: 'Aplicando preset…',
        confirm:
          '¿Aplicar el preset "{{name}}" a todos los agentes? Esto sobreescribirá tu configuración actual.',
      },
      fallback: {
        title: 'Modelo Fallback',
        description:
          'Modelo de respaldo usado cuando un agente no tiene configuración específica. Se aplica automáticamente con los presets.',
        autoResolve: 'Auto-resolver',
        resolved: 'Modelo fallback configurado: {{model}}',
        recommendedTitle: 'Modelos fallback recomendados (todo-terreno):',
      },
    },
  },
  providerStatus: {
    title: 'Estado de Proveedores LLM',
    refresh: 'Actualizar',
    tokens: 'Tokens',
    input: 'Entrada',
    output: 'Salida',
    estimated: 'Costo Est.',
    calls: 'llamadas',
    errors: 'errores',
    rateLimits: 'Límites de Tasa',
    noRateLimits: 'Límites de tasa no disponibles',
    lastSuccess: 'Último éxito',
    neverUsed: 'Nunca utilizado',
    justNow: 'hace un momento',
    minsAgo: 'hace {{count}} min',
    hoursAgo: 'hace {{count}}h',
    disclaimer:
      'Los costos son estimados basados en precios publicados por cada proveedor y pueden diferir de tu factura real.',
    unavailableToast:
      '{{provider}} no está disponible. Los agentes que lo usan cambiarán al proveedor secundario.',
  },
  notifications: {
    title: 'Notificaciones',
    markAllRead: 'Marcar todas como leídas',
    markRead: 'Marcar como leída',
    goTo: 'Ir al recurso',
    delete: 'Eliminar notificación',
    noNotifications: 'Sin notificaciones',
    justNow: 'Ahora mismo',
    pageSubtitle: 'Toda la actividad de tu cuenta y eventos del agente',
    sectionUnread: 'Sin leer',
    sectionRead: 'Anteriores',
    viewAll: 'Ver todas',
    tabAll: 'Todas',
    tabUnread: 'Sin leer',
    tabTrades: 'Trades',
    tabAgent: 'Agente',
    paginationInfo: '{{from}}–{{to}} de {{total}}',
  },
  help: {
    title: 'Documentación',
    subtitle: 'Todo lo que necesitas saber para operar en la plataforma',
    gettingStarted: 'Primeros Pasos',
    platformBehavior: 'Comportamiento de la Plataforma',
    agentGroup: 'Agente y Configuración',
    integrations: 'Integraciones',
    agentFlow: 'Cómo decide el Agente',
    agentPresets: 'Presets de Estrategia',
    agentParams: 'Referencia de Parámetros',
    agentCycle: 'Ciclo del Agente y Tiempo de Espera',
    tradeExecution: 'Flujo de Compra y Venta',
    conceptThresholds: 'Umbrales de Decisión',
    conceptSl: 'Stop Loss / Take Profit',
    conceptCapital: 'Capital por Trade',
    conceptInterval: 'Intervalo de Análisis',
    conceptOffset: 'Offset de Precio',
    faq: 'Preguntas Frecuentes',
    guide: 'Cómo Operar',
    apiKeys: 'Configuración de Claves API',
    behaviors: 'Comportamientos y Avisos Importantes',
    agentsShowcase: 'Agentes IA',
    stopAllTitle: 'Detener los agentes no cierra las posiciones abiertas',
    stopAllDesc:
      'Cuando detienes todos tus agentes (o un administrador activa el kill-switch), los agentes se detienen y sus trabajos programados se cancelan. Sin embargo, las posiciones abiertas permanecen abiertas en el exchange — NO se cierran automáticamente. En modo EN VIVO, esto significa que tus posiciones quedan sin stop-loss ni take-profit activos hasta que reinicies el agente. Recibirás una alerta en tiempo real si tienes posiciones sin cobertura. Ciérralas manualmente desde la página de Posiciones si es necesario.',
    back: 'Volver',
    binanceTitle: 'Claves API de Binance',
    binanceWarning:
      '⚠️ Nunca habilites permisos de retiro. El agente solo necesita leer y operar.',
    binanceStep1: 'Inicia sesión en Binance → Cuenta → Gestión de API',
    binanceStep2: 'Haz clic en "Crear API" → elige "Generado por el sistema"',
    binanceStep3:
      'Habilita permisos: ✅ Lectura ✅ Trading Spot — ❌ NO habilites retiros',
    binanceStep4:
      'Copia la API Key y Secret → pégalos en Ajustes → Claves API de Binance',
    claudeStep1: 'Ve a console.anthropic.com → API Keys',
    claudeStep2: 'Haz clic en "Create Key", copia el valor',
    claudeStep3:
      'En CryptoTrader → Ajustes → Claves LLM → Claude → pega la clave',
    openaiStep1: 'Ve a platform.openai.com → API Keys',
    openaiStep2: 'Haz clic en "Create new secret key", copia el valor',
    openaiStep3:
      'En CryptoTrader → Ajustes → Claves LLM → OpenAI → pega la clave',
    groqStep1: 'Ve a console.groq.com → API Keys',
    groqStep2: 'Haz clic en "Create API Key", copia el valor',
    groqStep3: 'En CryptoTrader → Ajustes → Claves LLM → Groq → pega la clave',
    faqItems: [
      {
        q: '¿Qué es CryptoTrader?',
        a: 'CryptoTrader es una plataforma que usa LLMs (Claude, OpenAI, Groq, Gemini, Mistral, Together, OpenRouter) para analizar el mercado y ejecutar operaciones automáticamente en tu cuenta de Binance. El agente lee datos del mercado, consulta al LLM para tomar una decisión y la ejecuta.',
      },
      {
        q: '¿El agente maneja mi dinero real?',
        a: 'En modo EN VIVO: sí, ejecuta órdenes reales en Binance usando tu API Key y el saldo disponible. En modo SANDBOX: simula todo con la misma lógica pero sin dinero real. Recomendamos empezar siempre con SANDBOX.',
      },
      {
        q: '¿Es seguro conectar mis claves de Binance?',
        a: 'Tus claves API se cifran con AES-256 en el servidor backend. Nunca se exponen en la UI ni en los logs. Recomendamos crear claves solo con permisos de "Lectura" + "Trading Spot" — nunca habilites retiros.',
      },
      {
        q: '¿Cómo sé si el agente está operando?',
        a: 'La página de Registro del Agente muestra cada decisión con todo el razonamiento. El Ticker de Precios muestra precios en vivo. La página de Posiciones muestra los trades abiertos. Todos los datos se actualizan en tiempo real vía WebSocket.',
      },
      {
        q: '¿Puedo perder dinero?',
        a: 'En modo EN VIVO: sí. El agente usa Stop Loss y Take Profit configurables para limitar pérdidas, pero ningún sistema es infalible. Empieza siempre con SANDBOX hasta que entiendas y confíes en los resultados.',
      },
      {
        q: '¿Qué proveedores de LLM están soportados?',
        a: 'Claude (Anthropic), OpenAI, Groq, Google Gemini, Mistral AI y Together AI — seis proveedores en total. Cada uno necesita su propia clave API configurada en Ajustes.',
      },
      {
        q: '¿Qué pares de criptomonedas están soportados?',
        a: 'Actualmente BTC/USDT, BTC/USDC, ETH/USDT y ETH/USDC. Se podrían añadir más pares en versiones futuras.',
      },
      {
        q: '¿Qué pasa con mis posiciones si detengo todos los agentes?',
        a: 'Las posiciones abiertas NO se cierran automáticamente. El agente deja de monitorearlas, por lo que en modo EN VIVO quedan sin stop-loss ni take-profit activos. Recibirás una notificación de alerta en tiempo real indicando cuántas posiciones quedaron sin cobertura. Ciérralas manualmente desde la página de Posiciones.',
      },
    ],
    guideSteps: [
      {
        title: 'Registrarse y completar el onboarding',
        desc: 'Crea tu cuenta y sigue el asistente de configuración para conectar tus claves y establecer la configuración inicial.',
      },
      {
        title: 'Conectar las claves API de Binance',
        desc: 'Ve a Ajustes → Claves API de Binance. Crea claves de lectura+trading spot en Binance y pégalas aquí.',
      },
      {
        title: 'Añadir una clave API de LLM',
        desc: 'Ve a Ajustes → Claves LLM. Elige Claude, OpenAI o Groq y añade tu clave API.',
      },
      {
        title: 'Configurar el agente',
        desc: 'Ve a Configuración. Selecciona BTC o ETH, elige el modo SANDBOX y ajusta los umbrales y parámetros de riesgo.',
      },
      {
        title: 'Iniciar el agente',
        desc: 'En la página de Configuración, haz clic en "Iniciar Agente" junto a tu configuración. El agente comenzará a analizar inmediatamente.',
      },
      {
        title: 'Monitorizar el rendimiento',
        desc: 'Observa el resumen del Dashboard, el Gráfico en Vivo, el Registro del Agente y las Posiciones. Los datos se actualizan en tiempo real.',
      },
      {
        title: 'Revisar análisis',
        desc: 'Tras ejecutar SANDBOX un tiempo, revisa Análisis: Tasa de Éxito, Gráfico G/P, Ratio de Sharpe, Drawdown.',
      },
      {
        title: 'Cambiar a EN VIVO (opcional)',
        desc: 'Solo cuando entiendas y confíes en los resultados: cambia el modo a EN VIVO en Configuración y reinicia el agente.',
      },
    ],
    binanceIntegrationTitle: 'Cómo opera con Binance',
    binanceIntegration: {
      subtitle:
        'Todo lo que ocurre entre esta plataforma y tu cuenta de Binance — mercado, órdenes, comisiones y seguridad.',
      marketTitle: 'Mercado Spot — sin apalancamiento',
      marketDesc:
        'Todas las operaciones son en Spot. No hay futuros, margin trading ni contratos de derivados. Cada orden compra o vende el activo directamente en tu cartera.',
      pairsTitle: 'Pares soportados',
      ordersTitle: 'Tipo de órdenes',
      ordersDesc:
        'La plataforma usa exclusivamente Market Orders. Se ejecutan al precio de mercado en el instante exacto en que el agente (o tú manualmente) decide actuar. No se usan órdenes límite ni stop-limit.',
      modesTitle: 'Modos de operación',
      sandboxTitle: 'SANDBOX (Paper Trading)',
      sandboxDesc:
        'Ninguna orden llega a Binance. El agente opera con 10.000 USDT virtuales usando precios reales obtenidos de la API pública de Binance sin autenticación. Ideal para probar sin riesgo.',
      liveTitle: 'EN VIVO',
      liveDesc:
        'Cada decisión del agente ejecuta una orden de mercado real en tu cuenta de Binance Spot. Tu API Key autentica y firma la request con HMAC-SHA256. El saldo y las posiciones son reales.',
      feesTitle: 'Comisiones',
      feesDesc:
        'Binance cobra 0,1% por operación en Spot. La plataforma aplica exactamente esa tasa en ambos modos para que el paper trading refleje el coste real.',
      feesEntry: 'Comisión de entrada',
      feesEntryFormula: 'precioEntrada × cantidad × 0,001',
      feesExit: 'Comisión de salida',
      feesExitFormula: 'precioSalida × cantidad × 0,001',
      feesNetFormula:
        'PnL neto = (precioSalida − precioEntrada) × cantidad − (comisión entrada + comisión salida)',
      feesExampleTitle: 'Ejemplo real',
      feesExampleSetup: 'Compras 0,01 BTC a $85.000 · vendes a $87.000',
      feesTableGrossPnl: 'PnL bruto',
      feesTableEntryFee: 'Comisión entrada',
      feesTableExitFee: 'Comisión salida',
      feesTableNetPnl: 'PnL neto',
      feesBnbNote:
        'Si pagas comisiones con BNB en Binance (25% de descuento), el PnL mostrado será levemente más conservador que el real. La plataforma no detecta ni gestiona el descuento BNB.',
      securityTitle: 'Seguridad de credenciales',
      securityDesc:
        'Tu API Key y Secret nunca se almacenan en texto plano ni se exponen en la interfaz.',
      securityStep1: 'Se cifran con AES antes de guardarse en base de datos.',
      securityStep2: 'Se desencriptan en memoria solo al ejecutar una orden.',
      securityStep3:
        'La request a Binance se firma con HMAC-SHA256 (requerido por la API).',
      securityStep4: 'Nunca se exponen en logs, WebSockets ni en la UI.',
      permissionsTitle: 'Permisos mínimos requeridos en Binance',
      permissionRead: 'Leer información de cuenta',
      permissionSpot: 'Trading Spot',
      permissionNoWithdraw: 'Retiros — NO habilitar nunca',
      minProfitNote:
        'El agente nunca vende de forma autónoma si la posición está en pérdida. Hay un umbral mínimo de rentabilidad (por defecto 0,3%) que debe superarse antes de ejecutar una venta automática. El cierre manual no tiene esta restricción.',
    },
    operationModesTitle: 'Modos de Operación',
    operationModesDesc:
      'La plataforma soporta tres modos de operación. Cada modo cambia cómo el motor de trading ejecuta las órdenes.',
    operationModes: {
      sandboxDesc:
        'Trading simulado con balance virtual ($10,000 por defecto). No se colocan órdenes reales. Perfecto para probar estrategias.',
      testnetDesc:
        'Se conecta a la API Testnet de Binance. Flujo de órdenes real con fondos ficticios. Valida la integración API sin riesgo financiero.',
      liveDesc:
        'Trading real con fondos reales en Binance. Las órdenes de mercado se ejecutan al instante. Usar con precaución.',
      warningTitle: 'Cambio de modo',
      warningDesc:
        'Cambiar de SANDBOX/TESTNET a LIVE requiere claves API de Binance con permisos de trading Spot. Las posiciones abiertas en sandbox se preservan pero se pausan.',
    },
    llmProvidersTitle: 'Proveedores LLM',
    llmProvidersDesc:
      'Cada agente puede funcionar con un proveedor LLM diferente. OpenRouter es el recomendado por defecto — da acceso a más de 300 modelos con una sola API key.',
    llmProviders: {
      openrouterDesc:
        'Más de 300 modelos, una sola API key. Modelos gratuitos disponibles.',
      claudeDesc: 'Modelos Claude vía la API de Anthropic.',
      openaiDesc: 'GPT-4o, GPT-4 Turbo y más.',
      groqDesc: 'Inferencia ultra-rápida con Llama, Mixtral.',
      geminiDesc: 'Modelos Google Gemini.',
      mistralDesc: 'Modelos Mistral AI.',
      togetherDesc: 'Hosting de modelos open-source.',
      tipTitle: 'Presets Inteligentes',
      tipDesc:
        'Usa el sistema de presets (Gratis / Equilibrado / Optimizado) para asignar automáticamente modelos recomendados a todos los agentes. Cada preset selecciona el mejor modelo según el rol del agente.',
      recommendedTitle: 'Modelos Recomendados por Agente',
      tableAgent: 'Agente',
      tableFree: 'Gratis',
      tableBalanced: 'Equilibrado',
      tableOptimized: 'Optimizado',
    },
    openrouterStep1: 'Crea una cuenta en openrouter.ai',
    openrouterStep2: 'Ve a Keys → Create Key',
    openrouterStep3: 'Copia la key (empieza con sk-or-)',
    openrouterStep4: 'Pega en Configuración → Proveedores LLM → OpenRouter',
    openrouterTip: 'Modelos gratuitos disponibles',
    openrouterTipDesc:
      'Muchos modelos en OpenRouter son gratuitos. Usa el preset "Gratis" para configurar todos los agentes con modelos de costo $0.',
  },
  common: {
    save: 'Guardar',
    saving: 'Guardando...',
    deleting: 'Eliminando...',
    cancel: 'Cancelar',
    loading: 'Cargando...',
    error: 'Algo salió mal',
    confirm: 'Confirmar',
    delete: 'Eliminar',
    edit: 'Editar',
    close: 'Cerrar',
    view: 'Ver',
    start: 'Iniciar',
    stop: 'Detener',
    status: 'Estado',
    role: 'Rol',
    action: 'Acción',
    actions: 'Acciones',
    empty: 'Sin elementos para mostrar',
    noData: 'Sin datos',
    afterFees: 'Después de comisiones',
    running: 'En ejecución',
    stopped: 'Detenido',
    pnl: 'G/P',
    recommended: 'Recomendado',
  },
  positions: {
    subtitle: 'Posiciones de trading actualmente abiertas',
    noPositionsHint:
      'Sin posiciones abiertas. Inicia un agente para comenzar a operar.',
    entryPrice: 'Precio de Entrada',
    opened: 'Apertura',
    openStatus: 'Abierta',
    confirmCloseTitle: '¿Cerrar posición?',
    confirmCloseDesc:
      'Esto ejecutará una orden de venta a mercado y no se puede deshacer.',
    tabOpen: 'Abiertas',
    tabClosed: 'Cerradas',
    exitPrice: 'Precio de Salida',
    closed: 'Cierre',
    loadingPrice: 'Cargando…',
    closeNow: 'Cerrar ahora',
    close: 'Cerrar',
    confirmClose: {
      currentPrice: 'Precio Actual',
      feesSection: 'Comisiones',
      entryFee: 'Comisión de Entrada (pagada)',
      exitFee: 'Comisión de Cierre (est. 0.1%)',
      estimatedPnl: 'G/P Neta Estimada',
    },
    modal: {
      title: 'Detalle de Posición',
      sectionPosition: 'Posición',
      sectionConfig: 'Configuración del Agente',
      sectionTrades: 'Trades Ejecutados',
      status: 'Estado',
      entryPrice: 'Precio de Entrada',
      exitPrice: 'Precio de Salida',
      quantity: 'Cantidad',
      fees: 'Comisiones',
      pnl: 'G/P',
      entryAt: 'Abierta',
      exitAt: 'Cerrada',
      stopLoss: 'Stop Loss',
      takeProfit: 'Take Profit',
      maxTrade: 'Máx. Trade %',
      buyThreshold: 'Umbral de Compra',
      sellThreshold: 'Umbral de Venta',
      minInterval: 'Intervalo Mínimo',
      priceOffset: 'Offset de Precio',
      maxPositions: 'Máx. Posiciones',
      tradeType: 'Tipo',
      tradePrice: 'Precio',
      tradeQty: 'Cant.',
      tradeFee: 'Comisión',
      tradeAt: 'Hora',
      noTrades: 'Sin trades registrados para esta posición.',
    },
  },
  tooltips: {
    pnl: 'Ganancias y Pérdidas — ganancias realizadas totales menos comisiones',
    winRate:
      'Porcentaje de trades que cerraron con beneficio respecto al total de trades',
    sharpeRatio:
      'Mide el retorno ajustado al riesgo. > 1 es bueno, > 2 es excelente',
    drawdown: 'Caída máxima desde el valor máximo del portafolio',
    bestTrade: 'Mayor ganancia de un solo trade cerrado',
    worstTrade: 'Mayor pérdida de un solo trade cerrado',
    pnlOpen:
      'Ganancias y Pérdidas — ganancia o pérdida no realizada de la posición abierta',
    pnlClosed: 'G/P realizada después de comisiones',
    binanceKeys:
      'Tus claves API de Binance están cifradas con AES-256 en el servidor. Nunca se exponen en la UI.',
    coingecko:
      'Noticias cripto gratuitas de la API pública de CoinGecko. Sin registro requerido.',
    coindesk:
      'CoinDesk es uno de los medios de noticias cripto más reconocidos. Obtenido vía RSS público.',
    cointelegraph:
      'CoinTelegraph cubre noticias cripto y blockchain a nivel mundial. Obtenido vía RSS público.',
    reddit:
      'Los posts más populares de r/CryptoCurrency y r/Bitcoin. Obtenido vía API JSON pública de Reddit.',
    bitcoinmagazine:
      'Bitcoin Magazine — noticias y análisis en profundidad sobre Bitcoin. RSS público.',
    theblock:
      'The Block — investigación institucional sobre cripto y DeFi. RSS público.',
    beincrypto:
      'BeinCrypto — noticias de mercado, DeFi y análisis Web3. RSS público.',
    newsdata:
      'NewsData.io — API REST con hasta 200 solicitudes gratuitas al día. Requiere clave API gratuita.',
    orderPriceOffset:
      'Ajusta el precio de referencia para órdenes relativo al mercado. Negativo = simular compra por debajo del mercado (más favorable). Positivo = comprar por encima del mercado. En modo LIVE, afecta el tamaño de la posición pero la orden se ejecuta al precio de mercado.',
    sandboxMode:
      'SANDBOX simula trades sin dinero real. EN VIVO usa tu saldo real de Binance.',
    buyThreshold:
      'Puntuación mínima que el LLM debe asignar para que el agente coloque una orden de COMPRA',
    sellThreshold:
      'Puntuación mínima que el LLM debe asignar para que el agente coloque una orden de VENTA',
    minProfit:
      'Ganancia mínima que debe tener la posición para que el agente ejecute el SELL del LLM. Evita cerrar con ganancias menores a las comisiones.',
    stopLoss:
      'Si la posición pierde este porcentaje, el agente la cerrará automáticamente para limitar pérdidas',
    takeProfit:
      'Si la posición gana este porcentaje, el agente la cerrará automáticamente para asegurar ganancias',
    maxTrade:
      'Porcentaje máximo de tu capital disponible a usar en un solo trade',
    maxPositions:
      'Número máximo de posiciones abiertas que el agente puede mantener simultáneamente',
    minInterval:
      'Tiempo mínimo (en minutos) entre dos decisiones del agente para el mismo activo',
    adminTotalUsers: 'Total de cuentas de usuario registradas',
    adminOpenPositions:
      'Número de posiciones de trading abiertas actualmente en todos los usuarios',
    adminTradesToday: 'Número de trades ejecutados hoy',
    adminPnlToday: 'G/P neta generada por todos los agentes hoy',
  },
  config: {
    tabForm: 'Configuración',
    tabGuide: 'Guía',
    tabExplain: 'Conceptos',
    docsCallout:
      '¿Querés entender cada parámetro antes de configurar? Consultá la documentación →',
    docsCalloutGuide: 'Ver Guía del Agente',
    docsCalloutConcepts: 'Ver Conceptos',
    editModal: { title: 'Editar Agente', aiModel: 'Modelo de IA' },
    deleteModal: {
      title: 'Eliminar Agente',
      body: '¿Estás seguro que querés eliminar este agente? Esta acción no se puede deshacer.',
      warning: 'Las posiciones abiertas no se cerrarán automáticamente.',
      confirm: 'Eliminar',
    },
    agentSingular: 'agente',
    agentPlural: 'agentes',
    noConfigsHint: 'Creá tu primer agente para comenzar a operar.',
    viewDetail: 'Ver detalle',
    stepper: {
      title: 'Nuevo Agente',
      openStepper: 'Nuevo Agente',
      back: 'Anterior',
      next: 'Siguiente',
      create: 'Crear Agente',
      stepPreset: 'Elige una estrategia de partida',
      stepPresetHint:
        'Los presets son un buen punto de inicio. Puedes ajustar cualquier parámetro en los pasos siguientes.',
      stepIdentity: 'Identidad del agente',
      stepIdentityHint:
        '¿Qué activo quieres operar, en qué modo y cómo se llamará este bot?',
      stepThresholds: 'Umbrales de decisión',
      stepThresholdsHint:
        'Define el nivel mínimo de confianza que el LLM debe alcanzar para que el agente actúe.',
      stepRisk: 'Gestión de riesgo',
      stepRiskHint:
        'Protege tu capital definiendo los límites de pérdida y ganancia por operación.',
      stepTiming: 'Timing y posiciones',
      stepTimingHint:
        'Controla cuántas posiciones simultáneas puede tener el bot y con qué frecuencia analiza el mercado.',
      stepReview: 'Revisar y crear',
      stepReviewHint:
        'Confirmá la configuración antes de guardar. Podés editar el agente en cualquier momento.',
      nameHint:
        'Un nombre que te ayude a identificar este bot rápidamente. Por ejemplo: "BTC Conservador" o "ETH Testnet".',
      modeHint:
        'SANDBOX opera con fondos virtuales, sin riesgo. TESTNET usa la red de pruebas de Binance. EN VIVO usa tu saldo real.',
      modeSandboxSub: 'Sin riesgo',
      modeTestnetSub: 'Red de pruebas',
      modeLiveSub: 'Dinero real',
      thresholdsCallout:
        'Un umbral más alto = menos operaciones pero más selectivas. Un umbral más bajo = más operaciones, más riesgo.',
      riskCallout:
        'El stop-loss cierra la posición si la pérdida supera el % configurado. Take-profit hace lo mismo si la ganancia supera el %.',
      customIntervalHint:
        'El agente esperará este tiempo entre análisis, independientemente de lo que sugiera el LLM.',
      reviewNote:
        'Estos parámetros se pueden editar desde la lista de agentes activos.',
      stepAiModel: 'Modelo de IA',
      stepAiModelHint:
        'Elegí qué proveedor y modelo LLM usará este agente para analizar. Dejalo en Auto para que el sistema elija el mejor disponible.',
      aiModelCallout:
        'Seleccioná el modelo de IA para este agente. Solo se muestran proveedores con API key activa. Podés omitir este paso para que el sistema elija automáticamente.',
      primaryLlm: 'Modelo primario',
      primaryLlmHint:
        'El modelo principal usado para análisis de mercado y decisiones de trading.',
      fallbackLlm: 'Modelo de respaldo (opcional)',
      fallbackLlmHint:
        'Se usa si el modelo primario no está disponible o tiene límite de uso.',
      autoSelect: 'Auto (el sistema elige)',
      noFallback: 'Sin respaldo',
      noActiveProviders:
        'No se encontraron proveedores LLM activos. Configurá tus API keys en Configuración → Modelos IA primero.',
      autoSuggestion:
        'Dejá ambos en Auto y el sistema elegirá el mejor modelo según tu perfil de riesgo.',
      primaryLabel: 'Primario',
      fallbackLabel: 'Respaldo',
      aiModelReview: 'Modelo de IA',
    },
    guide: {
      flowTitle: 'Cómo toma decisiones el Agente',
      presetsTitle:
        'Presets de estrategia — haz clic para auto-rellenar el formulario',
      paramTitle: 'Referencia de Parámetros',
      sourceMarket: 'Datos de Mercado',
      sourceNews: 'Noticias y Sentimiento',
      sourceNewsSub: '10 titulares recientes',
      sourceTrades: 'Trades Recientes',
      sourceTradesSub: 'últimas 10 ejecuciones',
      llmLabel: 'Análisis LLM',
      confidence: 'Puntaje de Confianza',
      decisionLogic: 'Lógica de Decisión',
      otherwise: 'De lo contrario',
      outcomeBuy: 'Orden de Compra',
      outcomeBuySub: 'Posición abierta',
      outcomeSL: 'Venta Automática',
      outcomeSLSub: 'Stop-loss / Take-profit',
      outcomeHold: 'Esperar',
      outcomeHoldSub: 'Aguardar minInterval min',
      agentFlowDesc:
        'En cada ciclo de análisis, el agente sigue un pipeline fijo de 4 pasos para decidir si operar o esperar.',
      agentFlowStep1: 'Recopilación de Datos',
      agentFlowStep1Desc:
        'El agente obtiene 200 velas OHLCV, calcula RSI · MACD · Bandas de Bollinger, lee tus últimas 10 operaciones ejecutadas y obtiene 10 titulares recientes del feed de noticias.',
      agentFlowStep2: 'Análisis LLM',
      agentFlowStep2Desc:
        'Todo el contexto recopilado se empaqueta en un prompt estructurado y se envía al LLM configurado (Claude, GPT-4o o Groq). El modelo devuelve un JSON con la decisión, un puntaje de confianza 0–100, texto de razonamiento y un tiempo de espera sugerido.',
      agentFlowStep3: 'Lógica de Decisión',
      agentFlowStep3Desc:
        'El puntaje de confianza se compara con tu buyThreshold / sellThreshold. Si ningún umbral se supera, o si ya tienes una posición abierta para el mismo activo, el agente registra HOLD y programa el siguiente ciclo.',
      agentFlowStep4: 'Ejecución de Orden',
      agentFlowStep4Desc:
        'Si el puntaje supera un umbral, el agente coloca una orden de mercado en Binance. Los niveles de Stop Loss y Take Profit se establecen inmediatamente sobre la nueva posición.',
      agentDecisionsTitle: 'Decisiones Posibles',
      agentDecisionBuy: 'BUY',
      agentDecisionBuyDesc:
        'Puntaje ≥ buyThreshold — abre una nueva posición larga con el % de capital configurado.',
      agentDecisionSell: 'SELL',
      agentDecisionSellDesc:
        'Puntaje ≥ sellThreshold Y tienes una posición en ganancia ≥ minProfitPct — la cierra al precio de mercado.',
      tradeExecTitle: 'Flujo de Compra y Venta',
      tradeExecSubtitle:
        'Cómo el agente decide cuándo abrir y cuándo cerrar posiciones, con la prioridad exacta de cada mecanismo.',
      tradeExecBuyTitle: 'Flujo de COMPRA',
      tradeExecBuyStep1: '¿El modelo de IA decide comprar?',
      tradeExecBuyStep2:
        'La confianza supera el umbral mínimo de compra (ej: 70%)',
      tradeExecBuyStep3:
        'La cantidad de posiciones abiertas no supera el máximo configurado',
      tradeExecBuyStep4:
        'Compra al precio de mercado más el ajuste de offset configurado',
      tradeExecBuyStep5:
        'El agente registra la posición, el trade y descuenta el capital del saldo',
      tradeExecSellTitle: 'Flujo de VENTA — 3 caminos (en orden)',
      tradeExecSell1Title: '1. SELL por decisión LLM (prioridad alta)',
      tradeExecSell1Desc:
        'Si el modelo de IA decide vender con suficiente confianza y la posición tiene una ganancia que supera el mínimo configurado, el agente cierra la posición. Si la ganancia no alcanza ese mínimo, la omite y deja actuar al Stop-Loss.',
      tradeExecSell2Title: '2. Take-Profit (techo de seguridad)',
      tradeExecSell2Desc:
        'Se evalúa después de la venta por IA en posiciones que siguen abiertas. Si el precio actual supera el precio de compra más el porcentaje de ganancia objetivo, el agente cierra la posición automáticamente.',
      tradeExecSell3Title: '3. Stop-Loss (último recurso)',
      tradeExecSell3Desc:
        'Si el precio actual cae por debajo del precio de compra menos el porcentaje de pérdida máxima, el agente cierra la posición para limitar el daño.',
      tradeExecExampleTitle: 'Ejemplo con configuración típica',
      tradeExecExampleBuy: 'Umbral de Compra',
      tradeExecExampleSell: 'Umbral de Venta',
      tradeExecExampleMinProfit: 'Ganancia Mínima LLM',
      tradeExecExampleTP: 'Take Profit',
      tradeExecExampleSL: 'Stop Loss',
      tradeExecExample1Title: 'Escenario A — LLM vende con ganancia',
      tradeExecExample1Desc:
        'Compraste BTC a $80,000. Precio actual $80,300 (+0.375%). La IA decide vender con 78% de confianza. Supera el umbral de venta ✓, ganancia 0.375% ≥ ganancia mínima 0.3% ✓ → el agente ejecuta la venta.',
      tradeExecExample2Title:
        'Escenario B — la IA quiere vender pero la ganancia es insuficiente',
      tradeExecExample2Desc:
        'Precio actual $80,100 (+0.125%). La IA decide vender → supera el umbral de venta ✓, pero ganancia 0.125% < ganancia mínima 0.3% ✗ → se omite. El Take-Profit y el Stop-Loss tampoco se activan → el agente registra espera y aguarda el próximo ciclo.',
      tradeExecManualTitle: 'Cierre manual',
      tradeExecManualDesc:
        'Desde /dashboard/positions podés cerrar cualquier posición abierta manualmente en cualquier momento, sin importar la ganancia o pérdida.',
      tradeExecNoteTitle: 'Sobre la ganancia mínima para venta',
      tradeExecNoteDesc:
        'Este parámetro protege contra cierres donde las comisiones del exchange (0.1% en Binance) se comerían toda la ganancia. El valor por defecto es 0.3%. Podés ajustarlo en la sección de Noticias del dashboard.',
      tradeExecPriorityLabel: 'Prioridad',
      tradeExecPriority1:
        'Venta por IA — cuando la ganancia supera el mínimo configurado',
      tradeExecPriority2:
        'Take-Profit — el precio alcanzó el objetivo de ganancias',
      tradeExecPriority3:
        'Stop-Loss — el precio cayó por debajo del límite de pérdida',
      agentDecisionHold: 'HOLD',
      agentDecisionHoldDesc:
        'Puntaje por debajo del umbral o sin señal accionable — espera hasta el próximo ciclo.',
      agentDecisionClose: 'CLOSE',
      agentDecisionCloseDesc:
        'Se activa el SL o TP automáticamente — posición cerrada para asegurar ganancia o limitar pérdida.',
      preset: {
        conservative: 'Conservador',
        conservativeDesc:
          'Bajo riesgo, umbrales altos, posiciones pequeñas. Ideal para nuevos usuarios.',
        balanced: 'Equilibrado',
        balancedDesc:
          'Punto de partida recomendado. Buen balance riesgo/recompensa.',
        aggressive: 'Agresivo',
        aggressiveDesc:
          'Mayor riesgo, umbrales más bajos, posiciones grandes. Solo para usuarios con experiencia.',
      },
      cardThresholds: 'Umbrales de Decisión',
      cardThresholdsDesc:
        'Controla el puntaje mínimo de confianza que debe retornar el LLM para que el agente actúe.',
      cardThresholdsTip:
        'Valores más altos = menos trades, más seguros. Empieza en 70%+.',
      cardRisk: 'Stop Loss / Take Profit',
      cardRiskDesc:
        'Reglas de salida automática que protegen tu capital en cada posición abierta.',
      slExample: 'Si BTC cae 3% desde la entrada → venta automática',
      tpExample:
        'Si BTC sube 5% desde la entrada → venta automática con ganancia',
      cardRiskTip: 'TP debería ser siempre mayor que SL (ej: SL=3%, TP=5%).',
      cardCapital: 'Capital por Trade',
      cardCapitalDesc:
        'Máximo % de tu balance que el agente puede usar en una sola orden.',
      capitalExample1: 'Balance: $10.000 · maxTrade: 10%',
      capitalExample2: '→ Tamaño máximo de orden: $1.000 por trade',
      cardCapitalTip: 'Empieza con 5–10%. Nunca superes 25% por trade.',
      cardTiming: 'Tiempos de Ciclo',
      cardTimingDesc:
        'Con qué frecuencia el agente evalua el mercado y cuántas posiciones puede tener.',
      timingExample1: 'minInterval: 60 min',
      timingExample2:
        '→ El agente evalúa el mercado como máximo una vez por hora',
      cardTimingTip:
        'Intervalos más largos = menos ruido. 60–120 min es un buen valor inicial.',
    },
    explain: {
      title: 'Conceptos de Configuración',
      subtitle:
        'Entendé qué hace cada parámetro antes de configurar el agente.',
      examplePrefix: 'Ejemplo con',
      profilesTitle: 'Por perfil de riesgo',
      profile: 'Perfil',
      executes: 'SE EJECUTA ✅',
      buyLabel: 'Compra',
      sellLabel: 'Venta',
      maxPositionsLabel: 'Máx. Posiciones',
      // Umbral
      thresholdTitle: 'Umbrales de Decisión',
      thresholdDesc:
        'Al final de cada ciclo de análisis, el LLM retorna un puntaje de confianza del 0 al 100. El umbral es el mínimo que debe alcanzar ese puntaje para que el agente ejecute realmente la operación. Si el puntaje queda por debajo, la decisión se loguea como HOLD y se espera el próximo ciclo.',
      thresholdTip:
        'Valores más altos = menos trades, más seguros. Empézar en 70% para BUY y 65% para SELL.',
      // Stop Loss / Take Profit
      slTitle: 'Stop Loss y Take Profit',
      slDesc:
        'Reglas de salida automática aplicadas a cada posición abierta. El Stop Loss vende cuando el precio cae X% desde tu entrada (limita pérdidas). El Take Profit vende cuando el precio sube X% desde tu entrada (asegura ganancias). Ambos se activan sin ninguna acción manual.',
      entryPrice: 'Precio de entrada',
      slTrigger: 'Stop Loss se activa en',
      result: 'Resultado',
      autoSell: 'VENTA AUTOMÁTICA 🔴',
      slTip:
        'Manté el Take Profit ≥ 1.5× el Stop Loss (ej: SL = 3%, TP = 5%). Esto asegura una relación riesgo/recompensa positiva a lo largo del tiempo.',
      // Capital
      capitalTitle: 'Capital por Trade',
      capitalDesc:
        'El máximo porcentaje de tu balance disponible que el agente puede usar en una sola orden de compra. Esto evita que el agente ponga todo tu capital en una sola posición y limita tu exposición por operación.',
      balance: 'Balance disponible',
      maxOrder: 'Tamaño máximo de orden',
      capitalTip:
        'Empézar con 5–10%. Nunca asignes más del 20–25% por trade, incluso con alta confianza.',
      // Intervalo
      intervalTitle: 'Intervalo de Análisis',
      intervalDesc:
        'El número mínimo de minutos entre ciclos de análisis del mercado. El agente no opera más seguido que este valor base. El sistema adaptativo puede extender el intervalo según la volatilidad, pero nunca lo acortará por debajo de este mínimo.',
      intervalComparison: 'Intervalo vs. frecuencia',
      freq30: '48 ciclos/día',
      freq60: '24 ciclos/día',
      freq120: '12 ciclos/día',
      costHigh: 'Alto costo / ruido',
      costMed: 'Equilibrado ✅',
      costLow: 'Bajo costo / estable',
      intervalTip:
        '60–120 min es ideal para la mayoría de estrategias. Intervalos cortos aumentan el costo de la API del LLM y exponen al agente al micro-ruido del mercado.', // Agent cycle
      cycleTitle: 'Ciclo del Agente y Tiempo de Espera',
      cycleDesc:
        'Después de cada ciclo de análisis el agente no vuelve a ejecutarse de inmediato. Espera un número calculado de minutos antes del siguiente ciclo. Este tiempo de espera proviene de dos fuentes independientes que se combinan.',
      cycleSource1Title: 'Espera sugerida por el LLM',
      cycleSource1Desc:
        'Cada vez que el LLM devuelve una decisión (COMPRA / VENTA / ESPERAR) también devuelve un campo llamado suggestedWaitMinutes — un número entre 1 y 60. El modelo decide este valor por sí mismo basándose en las condiciones actuales del mercado: indicadores (RSI, MACD), sentimiento de noticias y volatilidad. Si el mercado está neutro o incierto, el modelo normalmente sugiere una espera más larga como 30–60 min. Si hay una señal clara sugiere una espera más corta.',
      cycleSource2Title: 'Intervalo mínimo (tu configuración)',
      cycleSource2Desc:
        'En la configuración del agente estableces un intervalo mínimo en minutos. Este es el límite inferior: el agente nunca ejecutará ciclos más frecuentemente que este valor, sin importar lo que sugiera el LLM.',
      cycleCombined: 'Cómo se combinan',
      cycleCombinedDesc:
        'La espera real antes del siguiente ciclo es el máximo de los dos valores. Si el LLM dice 30 min y tu minInterval es 15 min, el agente espera 30 min. Si el LLM dice 5 min y tu minInterval es 15 min, el agente espera 15 min.',
      cycleFormula:
        'tiempoEspera = Math.max( suggestedWaitMinutes, minIntervalMinutes )',
      cycleExample1:
        'LLM sugiere 30 min · Tu minInterval: 15 min → Espera: 30 min',
      cycleExample2:
        'LLM sugiere 5 min · Tu minInterval: 15 min → Espera: 15 min',
      cycleExample3:
        'LLM sugiere 60 min · Tu minInterval: 15 min → Espera: 60 min',
      cycleTip:
        'Para garantizar ciclos más rápidos, baja tu minInterval en la configuración del agente. Pero ten en cuenta que el LLM siempre tiene la última palabra — puede seguir sugiriendo una espera mayor según las condiciones del mercado.',
      cycleLlmNote:
        'El valor suggestedWaitMinutes siempre se fuerza entre 1 y 60 minutos, incluso si el modelo devuelve un valor fuera de ese rango.', // Offset
      offsetTitle: 'Offset de Precio de Orden',
      offsetDesc:
        'Un ajuste porcentual aplicado al precio de mercado actual cuando se colocan órdenes límite de compra. Un offset negativo coloca la orden por debajo del mercado (mejor precio, puede tardar en ejecutarse). Uno positivo la coloca por encima (se ejecuta antes, ligero sobreprecio). En cero se ejecuta al precio de mercado.',
      offsetNegNote: 'precio mejor • puede esperar',
      offsetZeroNote: 'precio de mercado',
      offsetPosNote: 'se ejecuta rápido',
      offsetTip:
        'Usá –0.5% a –1% para entrar a precios ligeramente mejores. Usá 0% si preferís ejecución inmediata.',
    },
  },
  chat: {
    title: 'KRYPTO',
    subtitle: 'Tu agente de trading interno con IA',
    newSession: 'Nueva sesión',
    newSessionDesc:
      'Elegí el proveedor de IA y el modelo para esta conversación.',
    sessions: 'Conversaciones',
    messages: 'mensajes',
    noSessions: 'Aún no hay conversaciones.',
    startFirst: 'Iniciar primer chat',
    deleteSession: 'Eliminar sesión',
    deleteConfirm: '¿Eliminar esta conversación? No se puede deshacer.',
    openChat: 'Chat IA KRYPTO',
    openFullscreen: 'Abrir pantalla completa',
    resolvingAgent: 'Resolviendo agente…',
    defaultGreeting: '¡Hola, KRYPTO!',
    welcomeTitle: 'Hola, soy KRYPTO',
    welcomeDesc:
      'Tu agente de trading interno. Recuerdo mis decisiones pasadas y puedo ayudarte con la plataforma, mercados, operaciones y blockchain.',
    inputPlaceholder: 'Preguntale algo a KRYPTO...',
    stopStream: 'Detener generación',
    typing: 'KRYPTO está pensando...',
    noCredentials: 'No hay proveedores de IA configurados.',
    goToSettings: 'Ir a Ajustes → pestaña IA',
    selectProvider: 'Seleccionar IA...',
    loadingProviders: 'Cargando proveedores de IA...',
    startSession: 'Iniciar sesión',
    creating: 'Creando...',
    llmOverride: {
      label: 'Modelo',
      reset: 'Restaurar predeterminado de sesión',
      noModels: 'Sin modelos en esta categoría',
      searchPlaceholder: 'Buscar modelos...',
    },
    capabilities: {
      help: 'Ayuda de plataforma',
      trade: 'Asistente de operaciones',
      market: 'Análisis de mercado',
      blockchain: 'Guía de blockchain',
    },
    capabilityMessages: {
      help: 'Dame un resumen de todas las funciones de la plataforma y cómo usarlas.',
      trade: 'Ayudame a crear una nueva operación paso a paso.',
      market:
        'Analizá el mercado actual y dime si es momento de COMPRAR, VENDER o mantener posición.',
      blockchain:
        'Explicame los conceptos fundamentales de blockchain y DeFi que necesito conocer.',
    },
    copied: '¡Copiado!',
    copy: 'Copiar mensaje',
    errors: {
      RATE_LIMIT:
        'Se alcanzó el límite de solicitudes del proveedor de IA. Intentá de nuevo en {{retryAfter}} min.',
      RATE_LIMIT_no_retry:
        'Se alcanzó el límite de solicitudes del proveedor de IA. Intentá de nuevo en unos minutos.',
      CREDIT_LIMIT:
        'La cuenta del proveedor no tiene créditos. Agregá fondos en la página de facturación del proveedor.',
      INVALID_API_KEY:
        'La clave de API del proveedor no es válida o expiró. Revisá tu configuración en Ajustes → IA.',
      PROVIDER_UNAVAILABLE:
        'El proveedor de IA no está disponible en este momento. Intentá de nuevo más tarde.',
      PROVIDER_ERROR:
        'Ocurrió un error con el proveedor de IA. Intentá de nuevo o cambiá el proveedor.',
      CONNECTION_ERROR:
        'Se perdió la conexión con el servidor. Verificá tu conexión e intentá de nuevo.',
      CREATE_SESSION_ERROR:
        'No se pudo crear la sesión. Revisá tu clave de API en Ajustes.',
      DELETE_SESSION_ERROR: 'No se pudo eliminar la sesión.',
      LLM_PROVIDER_DISABLED:
        'Este proveedor LLM ha sido deshabilitado por el administrador.',
    },
  },
  agents: {
    selectAgent: 'Elige tu agente',
    providerNeedsAttention: 'Requiere atención — proveedor deshabilitado',
    tabStatus: 'Estado de Agentes',
    tabModels: 'Modelos por Defecto',
    recommendedModels: 'Modelos recomendados:',
    validated: 'Validado',
    deprecated: 'Deprecado',
    roles: {
      routing:
        'Clasificador rápido — enruta cada solicitud al agente especialista óptimo. Requiere baja latencia.',
      orchestrator:
        'Coordinador central — descompone tareas complejas, fusiona resultados multi-agente, produce respuestas finales.',
      synthesis:
        'Sintetizador profundo — genera reportes escritos comprensivos a partir del análisis multi-agente.',
      platform:
        'Experto en plataforma — gestiona funciones, configuración, navegación y onboarding de usuarios.',
      operations:
        'Asistente de operaciones — inicia/detiene agentes, aplica configs, ejecuta tareas de mantenimiento.',
      market:
        'Analista de mercado — análisis de precios, indicadores técnicos, señales de tendencia e insights de trading.',
      blockchain:
        'Experto en blockchain — protocolos DeFi, wallets, smart contracts e interpretación de datos on-chain.',
      risk: 'Gestor de riesgo — validación de stop-loss, cálculo de exposición, cumplimiento de seguridad del portafolio.',
    },
    kryptoDesc: 'Dejar que KRYPTO decida el mejor agente para tu pregunta',
    nexusDesc:
      'Experto en la plataforma — funciones, configuración, navegación',
    forgeDesc:
      'Asistente de operaciones — iniciar/detener agentes, gestionar configs',
    sigmaDesc: 'Analista de mercado — precios, indicadores, análisis técnico',
    cipherDesc: 'Experto en blockchain — DeFi, wallets, smart contracts',
    aegisDesc:
      'Gestor de riesgo — stop-loss, exposición, seguridad del portafolio',
    orchestratorDesc: 'Orquestador central — coordina todos los agentes',
    platformDesc:
      'Experto en la plataforma — funciones, configuración, navegación',
    operationsDesc:
      'Asistente de operaciones — iniciar/detener agentes, gestionar configs',
    marketDesc: 'Analista de mercado — precios, indicadores, análisis técnico',
    blockchainDesc: 'Experto en blockchain — DeFi, wallets, smart contracts',
    riskDesc:
      'Gestor de riesgo — stop-loss, exposición, seguridad del portafolio',
    agentSwitched: 'Agente cambiado a {{agent}} ({{provider}}/{{model}})',
    routedByKrypto: 'Enrutado por KRYPTO',
    orchestrating: 'KRYPTO coordinando…',
    toolCall: 'Solicitud de herramienta FORGE',
    pageDesc:
      'Gestiona las definiciones de agentes IA, prompts del sistema y documentos de base de conocimiento.',
    systemPrompt: 'Prompt del sistema',
    knowledgeBase: 'Base de conocimiento',
    dropZone: 'Arrastra un PDF, TXT o MD aquí, o haz clic para subir',
    noDocuments: 'No hay documentos subidos aún',
  },
  agentsShowcase: {
    badge: 'Sistema Multi-Agente',
    title: 'Conoce a los Agentes KRYPTO',
    subtitle:
      'Cinco agentes de IA especializados trabajando en conjunto — cada uno con su propia identidad, experiencia y marco de toma de decisiones. Juntos, forman una capa completa de inteligencia para trading de criptommonedas.',
    cta: 'Empezar a chatear',
    chatWith: 'Chatear con {{name}}',
    pipeline: {
      title: 'Cómo orquesta KRYPTO',
      subtitle:
        'Cada solicitud fluye a través de un pipeline inteligente que enruta, analiza y sintetiza entre agentes.',
      step1Title: 'Entrada del usuario',
      step1Desc: 'Tu pregunta o decisión de trading ingresa al sistema.',
      step2Title: 'Enrutamiento de intención',
      step2Desc: 'KRYPTO clasifica la intención y selecciona el agente óptimo.',
      step3Title: 'Análisis paralelo',
      step3Desc:
        'Hasta 4 agentes analizan simultáneamente con datos en tiempo real.',
      step4Title: 'Síntesis',
      step4Desc:
        'Los resultados se combinan en una respuesta unificada y accionable.',
    },
    nexus: {
      role: 'Experto en Plataforma',
      quote:
        'Soy NEXUS. Conozco cada rincón de CryptoTrader: cada parámetro, cada pantalla, cada decisión de diseño detrás del sistema.',
      description:
        'Tu guía personal a través de la plataforma CryptoTrader. NEXUS entiende cada parámetro de configuración, cada pantalla y cada flujo de trabajo. Desde onboarding de nuevos usuarios hasta explicar configuraciones avanzadas de agentes, NEXUS convierte la complejidad en claridad.',
      cap1: 'Onboarding paso a paso',
      cap2: 'Guía de configuración',
      cap3: 'Enrutamiento entre agentes',
      tag1: 'Onboarding',
      tag2: 'Navegación',
      tag3: 'FAQ',
    },
    forge: {
      role: 'Asistente de Operaciones',
      quote:
        'Soy FORGE. No analizo — actúo. Dame un objetivo y construimos el camino operativo para llegar.',
      description:
        'El operador práctico de CryptoTrader. FORGE ejecuta acciones: iniciar/detener agentes de trading, configurar estrategias, gestionar posiciones y ajustar parámetros de riesgo. Confirma antes de ejecutar y explica el impacto de cada acción.',
      cap1: 'Iniciar/detener agentes',
      cap2: 'Configuración de estrategia',
      cap3: 'Gestión de posiciones',
      tag1: 'Ejecución',
      tag2: 'Config',
      tag3: 'DeFi',
    },
    sigma: {
      role: 'Analista de Mercado',
      quote:
        'Soy SIGMA. Leo el mercado en datos, no en opiniones. Cada señal tiene un número detrás, y ese número cuenta una historia.',
      description:
        'Un analista de mercado frío y cuantitativo con acceso en tiempo real a datos de precio, indicadores técnicos y sentimiento de noticias. SIGMA interpreta RSI, MACD, Bandas de Bollinger, patrones de velas y métricas on-chain para entregar perspectivas de mercado objetivas.',
      cap1: 'Análisis técnico',
      cap2: 'Indicadores en tiempo real',
      cap3: 'Scoring de sentimiento',
      tag1: 'AT',
      tag2: 'Indicadores',
      tag3: 'On-Chain',
    },
    cipher: {
      role: 'Experto en Blockchain',
      quote:
        'Soy CIPHER. Blockchain no tiene secretos para mí — desde ECDSA hasta ZK Rollups. ¿Tienes una pregunta? La respondo desde cero o desde el nivel que necesites.',
      description:
        'La base de conocimiento profundo sobre criptomonedas y tecnología blockchain. CIPHER cubre todo desde criptografía de curvas elípticas hasta rollups Layer 2, protocolos DeFi, patrones de smart contracts, tokenomics y marcos regulatorios — adaptándose a cualquier nivel de experiencia.',
      cap1: 'Deep-dives de protocolos',
      cap2: 'Seguridad y criptografía',
      cap3: 'Educación DeFi',
      tag1: 'DeFi',
      tag2: 'L2',
      tag3: 'Web3',
    },
    aegis: {
      role: 'Gestor de Riesgo',
      quote:
        'Soy AEGIS, el gestor de riesgo de tu portfolio. Mi trabajo no es decirte qué va a pasar — es asegurarme de que nada de lo que pase te saque del juego.',
      description:
        'El guardián de tu portfolio. AEGIS evalúa cada decisión de trading a través de una lente de riesgo cuantitativa: sizing de posiciones con Kelly Criterion, límites de drawdown, análisis de correlación y cálculos de VaR. Cada BUY/SELL pasa por AEGIS antes de ejecutarse.',
      cap1: 'Risk scoring (0-100)',
      cap2: 'Protección de drawdown',
      cap3: 'Sizing de posiciones',
      tag1: 'VaR',
      tag2: 'Kelly',
      tag3: 'Stop-Loss',
    },
  },
  notificationMessages: {
    agentMaxActive:
      'Máximo {{max}} agentes activos permitidos. Detén un agente existente antes de iniciar uno nuevo.',
    agentNoLLM: 'Agente pausado: no hay credenciales LLM configuradas',
    agentNoTestnetKeys:
      'Agente pausado: no hay claves API de Binance Testnet configuradas',
    agentRateLimit:
      'Agente en espera: límite de requests de Binance alcanzado. Reintentando en {{retryMinutes}} min.',
    agentNetworkError:
      'Agente en espera: sin conexión a Binance. Reintentando en {{retryMinutes}} min.',
    agentLlmError:
      'Agente en espera: error del proveedor de IA (límite de requests). Reintentando en {{retryMinutes}} min.',
    agentError: 'Error del agente: {{message}}',
    tradeBuy: 'COMPRA {{qty}} {{asset}} @ ${{price}} ({{mode}})',
    tradeSell:
      'VENTA LLM {{qty}} {{asset}} @ ${{price}} | G/P: ${{pnl}} ({{mode}})',
    manualClose:
      'Posición cerrada manualmente: VENTA {{qty}} {{asset}} @ ${{price}} | G/P: ${{pnl}}',
    stopLoss:
      'Stop-loss activado: VENTA {{qty}} {{asset}} @ ${{price}} | G/P: ${{pnl}}',
    takeProfit:
      'Take-profit activado: VENTA {{qty}} {{asset}} @ ${{price}} | G/P: ${{pnl}}',
    orderError: 'Orden fallida: {{message}}',
  },
  balanceSource: {
    sandbox: 'Saldo virtual · Sandbox',
    testnet: 'Binance Testnet',
    live: 'Binance En Vivo',
    noKeysConfigured: 'Sin claves configuradas para este modo',
    loadingBalance: 'Cargando balance...',
    fetchError: 'No se pudo cargar el balance',
    goToSettings: 'Configurar API Keys',
  },
  auth: {
    loginTitle: 'Bienvenido de vuelta',
    loginSubtitle: 'Inicia sesión en tu cuenta de CryptoTrader',
    loginButton: 'Iniciar Sesión',
    noAccount: '¿No tienes cuenta?',
    createOne: 'Crear una',
    registerTitle: 'Crea tu cuenta',
    registerSubtitle: 'Empieza a operar con IA en minutos',
    registerButton: 'Crear Cuenta',
    alreadyHaveAccount: '¿Ya tienes cuenta?',
    signIn: 'Iniciar sesión',
    email: 'Correo electrónico',
    password: 'Contraseña',
    newPassword: 'Nueva Contraseña',
    confirmPassword: 'Confirmar Contraseña',
    passwordsNoMatch: 'Las contraseñas no coinciden',
    passwordTooShort: 'La contraseña debe tener al menos 8 caracteres',
    minCharsPlaceholder: 'Mínimo 8 caracteres',
  },
  onboarding: {
    steps: ['Conectar Exchange', 'Proveedor IA', 'Modo de Trading'],
    stepOf: 'Paso {{step}} de {{total}}',
    encryptionNote:
      'Todas las claves API se cifran con AES-256-GCM antes de almacenarse.',
    binanceTip: 'Consejo',
    binanceTipText:
      'Puedes omitir este paso y usar el modo Sandbox para practicar sin riesgo.',
    binanceApiKey: 'API Key de Binance',
    binanceApiKeyPlaceholder: 'Tu API Key de Binance',
    binanceApiSecret: 'Secreto API de Binance',
    binanceApiSecretPlaceholder: 'Tu API Secret de Binance',
    binanceHelpText:
      'Crea una API Key de lectura+trading (sin retiros) en la configuración de tu cuenta Binance.',
    binanceHelpLinkText: 'Abrir gestión de API de Binance →',
    skipBinance: 'Omitir por ahora — usar Trading Sandbox',
    skipTestnet: 'Omitir — no necesito trading en Testnet',
    aiProviderSubtitle:
      'Elige el proveedor de IA que impulsará tu agente de trading.',
    apiKey: 'Clave API',
    apiKeyPlaceholder: 'Tu clave API de {{provider}}',
    apiKeyHelp: 'Obtén tu clave API en',
    apiKeyHelpClaude: 'Obtén tu clave API en',
    apiKeyHelpOpenAI: 'Obtén tu clave API en',
    apiKeyHelpGroq: 'Obtén tu clave API en',
    sandboxTitle: 'Trading Sandbox',
    sandboxDesc:
      'Simula trades sin riesgo. El agente usa la lógica real pero sin dinero real.',
    sandboxRecommended: 'Recomendado para principiantes',
    testnetTitle: 'Binance Testnet',
    testnetDesc:
      'Órdenes reales en la testnet oficial de Binance. Sin dinero real; más fidelidad que Sandbox.',
    testnetRecommended: 'Para probar el flujo completo de trading',
    liveTitle: 'Trading En Vivo',
    liveDesc: 'Opera con fondos reales. Requiere claves API de Binance.',
    liveRequiresBinance: '⚠️ Requiere claves API de Binance (Paso 1)',
    testnetRequiresKeys: '⚠️ Requiere claves API de Binance Testnet',
    initialCapitalSandbox: 'Capital Inicial (USDT) — simulado',
    initialCapitalNote: 'Valor de referencia para tu portafolio simulado.',
    continue: 'Continuar',
    back: 'Atrás',
    startTrading: 'Comenzar a Operar',
    setupFailed: 'Configuración fallida. Por favor, inténtalo de nuevo.',
  },
  landing: {
    badge: 'Trading Crypto Multi-Agente · Potenciado por IA',
    headline1: '5 Agentes IA.',
    headline2: 'Una Misión:',
    headline3: 'Tu Ganancia.',
    sub: 'Un sistema multi-agente de IA analiza mercados, lee noticias, gestiona riesgo y ejecuta trades 24/7. Siete proveedores LLM. Tres modos de trading. Cero emociones.',
    startFree: 'Empezar gratis',
    badge1: '7 Proveedores IA',
    badge2: '5 Agentes Especializados',
    badge3: '3 Modos de Trading',
    // Stats
    stat1Value: '5',
    stat1Label: 'Agentes IA',
    stat2Value: '7',
    stat2Label: 'Proveedores LLM',
    stat3Value: '24/7',
    stat3Label: 'Monitoreo Activo',
    stat4Value: '4',
    stat4Label: 'Pares de Trading',
    stat5Value: '3',
    stat5Label: 'Modos de Trading',
    stat6Value: '10+',
    stat6Label: 'Indicadores Técnicos',
    // Cómo funciona
    howEyebrow: 'Cómo funciona',
    howTitle: 'Tus agentes trabajan mientras vos vivís',
    step1Title: 'Escanea y Analiza',
    step1Desc:
      'SIGMA monitorea pares BTC/ETH en tiempo real. RSI, MACD, Bollinger Bands, EMA, análisis de volumen y sentimiento de noticias — todo alimenta el motor de decisiones.',
    step2Title: 'IA Multi-Agente',
    step2Desc:
      'NEXUS enruta tu intención a FORGE, SIGMA, CIPHER o AEGIS. Cada agente se especializa en un dominio. Analizan en paralelo y sintetizan una respuesta unificada.',
    step3Title: 'Ejecuta y Protege',
    step3Desc:
      'AEGIS aplica límites de riesgo, position sizing y stop-loss. FORGE ejecuta con disciplina. Kill-switch disponible para detener todo al instante.',
    // Features (8 cards)
    featEyebrow: 'Plataforma completa',
    featTitle: 'Todo lo que necesitás para operar mejor',
    featSub:
      'Inteligencia multi-agente, análisis de noticias, 7 proveedores LLM y tres modos de trading — todo en una plataforma.',
    featCoreBadge: 'Core',
    featNewBadge: 'Nuevo',
    featFreeBadge: 'Gratis',
    feat1Title: 'Sistema Multi-Agente',
    feat1Desc:
      'Cinco agentes especializados — NEXUS, FORGE, SIGMA, CIPHER, AEGIS — trabajando en conjunto para trading, análisis, gestión de riesgo y expertise blockchain.',
    feat2Title: 'KRYPTO AI Chat',
    feat2Desc:
      'Asistente de IA conversacional con memoria de sesión. Preguntá sobre mercados, estrategias o la plataforma. Cada agente tiene personalidad y expertise únicos.',
    feat3Title: 'News Intelligence',
    feat3Desc:
      'Noticias crypto en tiempo real de CryptoPanic, NewsData.io y RSS. Análisis de sentimiento por LLM que alimenta directamente las decisiones de trading.',
    feat4Title: 'Análisis Técnico',
    feat4Desc:
      'RSI, MACD, Bollinger Bands, EMA, ATR, volumen y soporte/resistencia en tiempo real. Scoring de confluencia con 10+ indicadores.',
    feat5Title: 'Panel de Proveedores LLM',
    feat5Desc:
      'Configurá y monitoreá 7 proveedores IA desde un solo panel. Tracking de uso, selección de modelos y fallback automático si un proveedor no está disponible.',
    feat6Title: 'Gestión de Riesgo',
    feat6Desc:
      'Stop-loss, take-profit y position sizing automáticos. El agente AEGIS evalúa riesgo 0-100 usando Kelly Criterion, VaR y análisis de drawdown.',
    feat7Title: 'Tres Modos de Trading',
    feat7Desc:
      'Sandbox para paper trading, Binance Testnet para simulación realista, y Live para ejecución real. Cambiá de modo en cualquier momento.',
    feat8Title: 'Charts y Analytics en Vivo',
    feat8Desc:
      'Gráficos de velas estilo TradingView con indicadores superpuestos. Tracking de P&L en tiempo real, win rate y historial de decisiones.',
    // Multi-Agent section
    agentsEyebrow: 'Inteligencia Multi-Agente',
    agentsTitle: 'Conocé a los agentes KRYPTO',
    agentsSub:
      'Cinco agentes IA especializados, cada uno con nombre clave, personalidad y expertise únicos. Juntos forman una capa integral de inteligencia crypto.',
    agentNexus: 'NEXUS',
    agentNexusRole: 'Experto en Plataforma',
    agentNexusDesc:
      'Conoce cada pantalla, parámetro y workflow. Tu guía personal en CryptoTrader.',
    agentForge: 'FORGE',
    agentForgeRole: 'Operaciones',
    agentForgeDesc:
      'Ejecuta acciones: inicia agentes, configura estrategias, gestiona posiciones y parámetros de riesgo.',
    agentSigma: 'SIGMA',
    agentSigmaRole: 'Analista de Mercado',
    agentSigmaDesc:
      'Analista cuantitativo con acceso en tiempo real a precios, indicadores, patrones de velas y sentimiento.',
    agentCipher: 'CIPHER',
    agentCipherRole: 'Experto Blockchain',
    agentCipherDesc:
      'Conocimiento profundo en criptografía, protocolos DeFi, Layer 2, smart contracts y tokenomics.',
    agentAegis: 'AEGIS',
    agentAegisRole: 'Gestor de Riesgo',
    agentAegisDesc:
      'Evalúa cada trade con Kelly Criterion, VaR, límites de drawdown y position sizing.',
    // Providers (6)
    aiEyebrow: '7 Proveedores LLM',
    aiTitle: 'Elegí tu IA o usalas todas.',
    aiSub:
      'Configurá múltiples proveedores simultáneamente. Fallback automático asegura que tus agentes nunca se detengan.',
    claude: 'Anthropic Claude',
    claudeModel: 'claude-sonnet-4 · claude-haiku',
    claudeDesc:
      'Razonamiento profundo y contexto extenso. La opción preferida para análisis matizados de riesgo y estrategias de largo plazo.',
    claudeTag: 'Razonamiento',
    openai: 'OpenAI GPT',
    openaiModel: 'gpt-4o · gpt-4o-mini',
    openaiDesc:
      'El estándar de la industria. Versatilidad, velocidad y confiabilidad probada en entornos de producción de alto volumen.',
    openaiTag: 'Versatilidad',
    groq: 'Groq',
    groqModel: 'llama-3.3-70b · llama-3.1-8b',
    groqDesc:
      'Inferencia ultrarrápida con hardware especializado. Ideal para análisis de alta frecuencia y decisiones de latencia mínima.',
    groqTag: 'Velocidad',
    gemini: 'Google Gemini',
    geminiModel: 'gemini-2.5-flash · gemini-2.5-pro',
    geminiDesc:
      'Capacidades multimodales con ventanas de contexto masivas. Excelente para cruzar datos de mercado complejos.',
    geminiTag: 'Multimodal',
    mistral: 'Mistral AI',
    mistralModel: 'mistral-large · mistral-medium',
    mistralDesc:
      'Excelencia europea en IA. Rendimiento analítico sólido con uso eficiente de recursos y enfoque privacy-first.',
    mistralTag: 'Eficiente',
    together: 'Together AI',
    togetherModel: 'Llama 4 Maverick · Llama 4 Scout',
    togetherDesc:
      'Modelos open-source a escala. Accedé a los últimos modelos Llama con infraestructura y pricing enterprise.',
    togetherTag: 'Open Source',
    openrouter: 'OpenRouter',
    openrouterModel: '300+ modelos · API unificada',
    openrouterDesc:
      'Una sola API key para acceder a todos los modelos: Claude, GPT, Gemini, Llama, Mistral y más. Ruteo inteligente elige el mejor modelo para cada tarea.',
    openrouterTag: 'Universal',
    openrouterRecommended: 'Recomendado',
    // Trading modes
    modesEyebrow: 'Tres formas de operar',
    modesTitle: 'Tu ritmo. Tus reglas.',
    modesSub:
      'Empezá seguro en Sandbox, subí de nivel en Testnet, y pasá a Live cuando estés listo.',
    modeSandbox: 'Sandbox',
    modeSandboxDesc:
      'Paper trading con wallet virtual y precios reales del mercado. Riesgo cero, aprendizaje total.',
    modeTestnet: 'Testnet',
    modeTestnetDesc:
      'Órdenes reales en Binance Testnet. Experimentá el flujo completo de trading sin dinero real.',
    modeLive: 'Live Trading',
    modeLiveDesc:
      'Fondos reales en Binance. Controles de riesgo automáticos y protección kill-switch.',
    // Risk
    riskEyebrow: 'Tu capital protegido',
    riskTitle: 'AEGIS: Diseñado para proteger primero',
    risk1Title: 'Stop-Loss Automático',
    risk1Desc:
      'Cierra posiciones antes de que las pérdidas sobrepasen tu tolerancia.',
    risk2Title: 'Take-Profit Inteligente',
    risk2Desc:
      'Asegura ganancias automáticamente cuando se alcanza el objetivo.',
    risk3Title: 'Kill-Switch Global',
    risk3Desc:
      'Detiene toda actividad del agente con un solo click en cualquier momento.',
    risk4Title: 'Position Sizing',
    risk4Desc:
      'Riesgo por operación calculado con Kelly Criterion y reglas de allocation.',
    // CTA
    ctaEyebrow: 'Comenzá hoy mismo',
    ctaTitle1: '¿Listo para que 5 agentes IA',
    ctaTitle2: 'operen por vos?',
    ctaSub:
      'Creá tu cuenta, elegí tus proveedores, activá tus agentes en minutos. No se necesita experiencia previa en trading.',
    ctaStart: 'Crear cuenta gratis',
    ctaGitHub: 'Ver en GitHub',
    ctaDisclaimer:
      'Paper Trading disponible. Sin tarjeta de crédito. Solo fines educativos.',
    // Footer
    footerTagline: 'Plataforma Multi-Agente de Trading IA',
    footerBy: 'Desarrollado por',
    footerDisclaimer:
      'Solo fines educativos. El trading de criptomonedas implica riesgo de pérdida.',
    footerPlatformTitle: 'Plataforma',
    footerResourcesTitle: 'Links',
    footerHelp: 'Ayuda y Guía',
    footerSignUp: 'Crear cuenta',
    footerLogin: 'Iniciar sesión',
    footerAITitle: 'Modelos de IA',
  },
  botAnalysis: {
    title: 'Análisis del Bot',
    subtitle:
      'Razonamiento técnico, sentimiento de noticias e historial de decisiones de la IA',
    tabAnalysis: 'Análisis',
    tabAgentLog: 'Registro del Agente',
    agentLogSubtitle:
      'Historial de todas las decisiones tomadas por el agente de trading IA',
    refresh: 'Actualizar',
    updatedAgo: 'hace {{count}} min',
    techSignal: 'Señal Técnica',
    newsSentiment: 'Sentimiento Noticias',
    lastDecision: 'Última Decisión IA',
    scoreOf: 'Score {{score}} de 8 indicadores',
    sentimentScoreLabel: 'Score {{score}} en noticias recientes',
    noData: 'Sin datos',
    startAgent: 'Inicia un agente para ver datos',
    technicalAnalysis: 'Análisis Técnico',
    confluenceScore: 'Puntaje de confluencia',
    strong: 'fuerte',
    entry: 'Entrada',
    stopLoss: 'Stop Loss',
    takeProfit: 'Take Profit',
    newsSentimentTitle: 'Sentimiento de Noticias',
    loadingNews: 'Cargando noticias…',
    newsUsedByBot: 'El bot usa noticias en sus decisiones',
    newsNotUsedByBot: 'El bot no usa noticias en sus decisiones',
    newsWeightLabel: 'de influencia',
    configureNews: 'Configurar',
    loadingConfig: 'Cargando config…',
    viewIndicators: 'Indicadores',
    inputSummaryTitle: 'Entradas del Agente',
    inputSummarySubtitle: '— datos enviados al agente antes de cada decisión',
    inputGroupPrice: 'Precio',
    inputGroupIndicators: 'Indicadores',
    inputGroupNews: 'Noticias',
    inputGroupConfig: 'Config',
    inputGroupHistory: 'Historial Decisiones',
    inputHistoryEmpty: 'Sin decisiones aún',
    nextDecisionTitle: 'Próxima Decisión del Agente',
    nextDecisionIn: 'Próxima decisión en',
    nextDecisionNow: 'Analizando...',
    nextDecisionAnalyzing: 'Analizando...',
    lastDecisionLabel: 'Última decisión',
    inputCurrentPrice: 'Precio',
    inputChange24h: 'Cambio 24h',
    inputTechSignal: 'Señal Téc',
    inputVolume: 'Volumen',
    inputSupportResistance: 'S / R',
    inputNewsEnabled: 'Bot usa noticias',
    inputNewsEnabledYes: '✓ Activo (peso {{weight}}%)',
    inputNewsEnabledNo: '✗ Desactivado',
    inputAnalysisMethod: 'Método',
    inputNewsSentiment: 'General',
    inputNewsDistribution: 'Distribución',
    inputConfigPair: 'Par / Modo',
    inputBuyThreshold: 'Umbral Compra',
    inputSellThreshold: 'Umbral Venta',
    inputStopLoss: 'Stop Loss',
    inputTakeProfit: 'Take Profit',
    inputRiskZone: 'Niveles de Riesgo',
    inputAgentRunning: '{{count}} agente activo',
    positiveNews: '{{count}} positivas',
    negativeNews: '{{count}} negativas',
    neutralNews: '{{count}} neutras',
    sentimentBull: 'Alcista',
    sentimentBear: 'Bajista',
    sentimentNeutral: 'Neutral',
    badgeAi: 'IA',
    scoreLabel: 'Score',
    sigmaTitle: 'Conclusión SIGMA',
    sigmaCached: 'Reutilizado de otro agente',
    sigmaImpactPositive: 'Impacto positivo',
    sigmaImpactNegative: 'Impacto negativo',
    sigmaImpactNeutral: 'Impacto neutral',
    detectedFactors: 'Factores detectados',
    decisionHistory: 'Historial de Decisiones del Agente',
    records: '{{count}} registros',
    noDecisions: 'Sin decisiones del agente todavía.',
    noDecisionsHint:
      'Inicia un agente de trading para ver el historial de razonamiento aquí.',
    waitMinutes: 'Esperar {{count}} min antes de la próxima acción',
    justification: 'Justificación',
    signalBUY: 'COMPRAR',
    signalSELL: 'VENDER',
    signalHOLD: 'MANTENER',
    signalNEUTRAL: 'NEUTRAL',
    sentimentBULLISH: 'Alcista',
    sentimentBEARISH: 'Bajista',
    timeNow: 'ahora',
    timeMin: '{{count}}min',
    timeHour: '{{count}}h',
    timeDay: '{{count}}d',
    agentDecisions: '{{count}} decisiones',
    noAgentDecisions: 'Sin decisiones del agente todavía',
    noAgentDecisionsHint:
      'Inicia un agente de trading para ver el razonamiento y las decisiones de la IA aquí.',
    confidence: 'Confianza',
    viewCurrentState: 'Ver Estado Actual',
    currentState: 'Estado actual',
    agentStatus: 'Estado del agente',
    tabs: {
      status: 'Estado',
      indicators: 'Indicadores',
      news: 'Noticias',
      config: 'Config',
    },
    ind: {
      histogram: 'Histograma',
      macdCross: 'Cruce MACD',
      emaTrend: 'Tendencia EMA',
      bbUpper: 'BB Superior',
      bbMiddle: 'BB Media',
      bbLower: 'BB Inferior',
      bbPosition: 'Posición en BB',
      volumeCurrent: 'Volumen actual',
      volumeAvg: 'Volumen promedio',
      volumeRatio: 'Ratio de volumen',
      volumeSignal: 'Señal de volumen',
      supports: 'Soportes',
      resistances: 'Resistencias',
    },
    noDecisionsYet: 'El agente aún no ha tomado ninguna decisión.',
  },
  modeSelector: {
    label: 'Modo de operación',
    sandbox: 'Sandbox',
    testnet: 'Testnet',
    live: 'En Vivo',
    sandboxDesc: 'Simulación con fondos virtuales. Sin riesgo real.',
    testnetDesc: 'Órdenes reales en red de prueba de Binance. Sin dinero real.',
    liveDesc: 'Dinero real. Órdenes reales en Binance.',
    liveWarningShort: 'Opera con dinero real',
    switchConfirmTitle: 'Cambiar a modo En Vivo',
    switchConfirmDesc:
      'Estás a punto de cambiar al modo EN VIVO. Las operaciones afectarán fondos reales en Binance.',
    confirmLive: 'Sí, cambiar a En Vivo',
    switchedSuccess: 'Modo cambiado a {{mode}}',
    fallbackNotice:
      'Modo {{mode}} no disponible. Cambiado a Sandbox automáticamente.',
    credentialsModalTitle: 'Modo {{mode}} no configurado',
    credentialsModalTestnetDesc:
      'Para operar en modo Testnet necesitás configurar tus claves API de Binance Testnet. Obtenelas gratis en testnet.binance.vision (sin dinero real).',
    credentialsModalLiveDesc:
      'Para operar en modo En Vivo necesitás configurar tus claves API de Binance. Este modo opera con fondos reales en Binance.',
    credentialsModalCancel: 'Cancelar',
    credentialsModalCta: 'Agregar Credenciales',
    pauseAgentsTitle: '{{count}} agente(s) activo(s) en {{mode}}',
    pauseAgentsDesc:
      'Tenés {{count}} agente(s) corriendo en modo {{fromMode}}. Al cambiar a {{toMode}} se detendrán automáticamente.',
    pauseAgentsLiveWarning:
      'Los agentes en modo En Vivo tienen posiciones abiertas que quedarán sin cobertura al detenerlos.',
    pauseAgentsCta: 'Detener y cambiar',
    pauseAgentsStopping: 'Deteniendo...',
  },
  toasts: {
    // admin
    killSwitchSuccess: 'Kill switch activado — todo el trading detenido',
    killSwitchError: 'Error al activar el kill switch',
    userStatusUpdated: 'Estado del usuario actualizado',
    userStatusError: 'Error al actualizar el estado del usuario',
    // admin agents
    agentUpdated: 'Agente actualizado',
    agentUpdateError: 'Error al actualizar el agente',
    docUploaded: 'Documento cargado, procesamiento iniciado',
    docUploadError: 'Error al cargar el documento',
    docDeleted: 'Documento eliminado',
    docDeleteError: 'Error al eliminar el documento',
    // binance keys
    binanceKeysSaved: 'Claves API de Binance guardadas',
    binanceKeysDeleted: 'Claves de Binance eliminadas',
    binanceKeysSaveError: 'Error al guardar las claves',
    binanceKeysDeleteError: 'Error al eliminar las claves',
    // binance testnet keys
    testnetKeysSaved: 'Claves API de Binance Testnet guardadas',
    testnetKeysDeleted: 'Claves de Binance Testnet eliminadas',
    testnetKeysSaveError: 'Error al guardar las claves testnet',
    testnetKeysDeleteError: 'Error al eliminar las claves testnet',
    testnetConnectionSuccess: 'Conexión con Binance Testnet exitosa',
    testnetConnectionError: 'Error de conexión testnet: {{error}}',
    testnetConnectionTestError: 'Error al probar la conexión testnet',
    // llm keys
    llmKeySaved: 'Clave API de LLM guardada',
    llmKeySaveError: 'Error al guardar la clave',
    llmKeyDeleted: 'Clave LLM eliminada',
    llmKeyDeleteError: 'Error al eliminar la clave',
    // profile
    profileUpdated: 'Perfil actualizado',
    profileUpdateError: 'Error al actualizar el perfil',
    // news api keys
    newsKeySaved: 'Clave API de noticias guardada',
    newsKeySaveError: 'Error al guardar la clave',
    newsKeyDeleted: 'Clave API de noticias eliminada',
    newsKeyDeleteError: 'Error al eliminar la clave',
    // platform mode
    modeChangeError: 'Error al cambiar el modo de operación',
    modeFallback:
      'Modo {{mode}} no disponible. Cambiado a Sandbox automáticamente.',
  },
  docs: {
    pagination: {
      previous: 'Anterior',
      next: 'Siguiente',
    },
    feedback: {
      question: '¿Esta página fue útil?',
      yes: 'Sí',
      no: 'No',
      thanksYes: '¡Gracias por tu opinión!',
      thanksNo: 'Gracias — trabajaremos en mejorar esta página.',
    },
    group: {
      gettingStarted: 'Primeros Pasos',
      platform: 'Plataforma',
      integration: 'Integración',
      integrations: 'Integraciones',
      configuration: 'Configuración',
      reference: 'Referencia',
      support: 'Soporte',
    },
    quickstart: {
      title: 'Inicio rápido',
      intro:
        'Pon en marcha CryptoTrader en minutos. Esta guía te lleva por la creación de cuenta, la configuración de tu proveedor de IA y el lanzamiento de tu primer agente de trading.',
      whatIsTitle: '¿Qué es CryptoTrader?',
      whatIsDesc:
        'CryptoTrader es una plataforma de trading de criptomonedas impulsada por IA que utiliza un sistema multi-agente para analizar mercados, gestionar el riesgo y ejecutar operaciones en Binance. La plataforma soporta tres modos de operación (Sandbox, Testnet, Live) e integra 7 proveedores LLM para potenciar sus 8 agentes de IA especializados.',
      createAccountTitle: 'Crea tu cuenta',
      step1: 'Navega a la página de registro',
      step1Desc: 'Ve a /register y crea tu cuenta con email y contraseña.',
      step2: 'Completa el asistente de configuración',
      step2Desc:
        'Elige tu modo de operación (Sandbox recomendado), configura las claves del exchange, el proveedor LLM y crea tu primer agente.',
      configureLlmTitle: 'Configura tu proveedor LLM',
      configureLlmDesc:
        'Los agentes de IA necesitan un proveedor LLM para funcionar. Se recomienda OpenRouter — una sola clave API da acceso a más de 300 modelos, incluidos los gratuitos.',
      llmStep1: 'Ve a Configuración → Proveedores LLM',
      llmStep2: 'Ingresa tu clave API de OpenRouter',
      llmStep2Desc: 'Obtén una en openrouter.ai/keys — comienza con sk-or-',
      llmStep3: 'Usa un Preset para asignar modelos automáticamente',
      llmStep3Desc:
        'Gratis ($0), Balanceado (buena relación) u Optimizado (mejor calidad).',
      firstAgentTitle: 'Crea tu primer agente de trading',
      agentStep1: 'Ve a Config. de Agentes en el dashboard',
      agentStep2: 'Haz clic en "Nuevo Agente" para abrir el asistente',
      agentStep3: 'Elige un nombre, par de trading (ej. BTCUSDT) y modo',
      agentStep4: 'Configura los parámetros o usa los valores por defecto',
      agentStep4Desc:
        'Umbral Compra/Venta: 70%, Stop Loss: 3%, Take Profit: 5%, Trade Máximo: 5% del capital.',
      agentStep5: 'Haz clic en Crear — el agente está listo',
      startAgentTitle: 'Inicia el agente',
      startStep1:
        'Encuentra la tarjeta de tu agente en la página Config. de Agentes',
      startStep2: 'Haz clic en el botón Play para iniciarlo',
      startStep3: 'Monitorea la actividad en Log de Agentes y Posiciones',
      startStep3Desc:
        'El agente obtendrá datos del mercado, consultará al sistema multi-agente de IA y ejecutará operaciones automáticamente según tus umbrales.',
      tipTitle: 'Consejo',
      tipContent:
        'Comienza con el modo Sandbox y el Preset Gratuito para aprender la plataforma sin ningún costo. Puedes cambiar a trading en vivo una vez que te sientas cómodo con el sistema.',
    },
    platformBehavior: {
      title: 'Comportamiento de la plataforma',
      intro:
        'Comportamientos importantes, advertencias y mecanismos que debes entender antes de operar.',
      stopAllWarning: 'Importante',
      stopAllNote:
        'Las posiciones abiertas existentes permanecen abiertas después de Detener Todo. Debes cerrar las posiciones manualmente o reiniciar los agentes para reanudar el trading.',
      lifecycleTitle: 'Ciclo de vida de posiciones',
      lifecycleDesc:
        'Las posiciones siguen un ciclo de vida estricto: ABIERTAS cuando se ejecuta una operación de COMPRA, monitoreadas en cada ciclo, y CERRADAS cuando se ejecuta una operación de VENTA (manual o automática).',
      lifecycleAutoSell:
        'Condiciones de venta automática: umbral de take-profit alcanzado, umbral de stop-loss alcanzado, o el agente IA recomienda VENTA con suficiente confianza Y el umbral mínimo de beneficio se cumple (por defecto 0.3%).',
      noLossTitle: 'Sin ventas con pérdida autónomas',
      rateLimitTitle: 'Límites de tasa',
      rateLimitDesc:
        'Cada agente tiene un intervalo mínimo configurable entre ciclos de análisis (por defecto: 5 minutos). En modo AGENTE, la IA sugiere el tiempo de espera óptimo según la volatilidad del mercado. En modo PERSONALIZADO, se usa un intervalo fijo.',
      dataRefreshTitle: 'Actualización de datos',
      dataRefreshDesc:
        'Los precios de mercado se actualizan vía WebSocket en tiempo real. Los datos del portafolio se refrescan cada 30 segundos. Las decisiones de los agentes aparecen en el Log de Agentes inmediatamente después de cada ciclo.',
      autoStopTitle: 'Auto-parada al cambiar configuración',
      autoStopDesc:
        'La plataforma detiene automáticamente un agente cuando modificas su configuración. Esto evita que el agente opere con parámetros desactualizados. Tras guardar los cambios, debes reiniciar el agente manualmente.',
    },
    agents: {
      title: 'Agentes',
      intro:
        'CryptoTrader utiliza un sistema multi-agente donde cada agente es una IA especializada con un rol específico. Los agentes colaboran mediante una capa de orquestación para producir decisiones de trading.',
      architectureTitle: 'Arquitectura multi-agente',
      architectureDesc:
        'El sistema tiene tres capas: (1) Capa de Enrutamiento — clasifica la intención del usuario y la dirige al agente correcto, (2) Agentes Especialistas — expertos en dominios que analizan aspectos específicos, (3) Capa de Síntesis — combina las salidas de los agentes en una decisión final.',
      kryptoRole: 'El Orquestador (2 roles configurables)',
      kryptoDesc:
        'KRYPTO es la columna vertebral del sistema multi-agente. Opera con dos roles LLM configurables de forma independiente. La coordinación de orquestación es manejada internamente por el framework.',
      kryptoRouting:
        'Clasifica solicitudes entrantes y las enruta al especialista apropiado',
      kryptoSynth:
        'Combina salidas en BUY/SELL/HOLD final con puntuación de confianza',
      ultraFast: 'Ultra-rápido (Gemma 4, Qwen 3.5)',
      highQuality: 'Alta calidad (DeepSeek V4 Pro, Kimi K2)',
      role: 'Rol',
      function: 'Función',
      modelType: 'Modelo recomendado',
      specialistsTitle: 'Agentes especialistas',
      agent: 'Agente',
      codename: 'Nombre clave',
      domain: 'Dominio',
      specialty: 'Especialidad',
      nexusDomain: 'Funcionalidad de plataforma',
      nexusSpec:
        'Conoce la plataforma al detalle, explica funciones y configuraciones',
      forgeDomain: 'Ejecución de trades',
      forgeSpec:
        'Tipos de órdenes, tiempos de ejecución, restricciones operativas',
      sigmaDomain: 'Análisis de datos de mercado',
      sigmaSpec:
        'RSI, MACD, Bandas de Bollinger, perfiles de volumen, soporte/resistencia',
      cipherDomain: 'Blockchain y on-chain',
      cipherSpec: 'Métricas on-chain, movimientos de ballenas, tendencias DeFi',
      aegisDomain: 'Evaluación de riesgos',
      aegisSpec:
        'Tamaño de posiciones, límites de exposición, gestión de drawdown',
      showcaseTitle: 'Showcase de agentes',
      configTitle: 'Configuración de agentes',
      configInfoTitle: 'Personalización por agente',
      configInfo:
        'Cada agente puede configurarse individualmente con su propio proveedor LLM, modelo específico y modelos recomendados por el administrador. Ve a Configuración → Agentes para personalizar.',
    },
    agentFlow: {
      title: 'Flujo de decisión del agente',
      intro:
        'Entiende cómo el agente toma decisiones de trading paso a paso, desde la recolección de datos hasta la ejecución del trade.',
      cycleTitle: 'El ciclo de decisión',
      step1: 'Recolección de datos',
      step1Desc:
        'Obtener los últimos datos del mercado, velas OHLCV e indicadores técnicos para el par configurado.',
      step2: 'Consulta multi-agente',
      step2Desc:
        'El orquestador (KRYPTO) enruta los datos del mercado a los especialistas: SIGMA para análisis de mercado, AEGIS para riesgos, CIPHER para blockchain.',
      step3: 'Síntesis',
      step3Desc:
        'KRYPTO sintetiza las opiniones de los especialistas en una sola recomendación: COMPRAR, VENDER o MANTENER.',
      step4: 'Verificación de confianza',
      step4Desc:
        'La recomendación incluye una puntuación de confianza (0-100%). Se compara con los umbrales de compra/venta del agente.',
      step5: 'Ejecución',
      step5Desc:
        'Si la confianza supera el umbral Y todas las verificaciones de seguridad pasan, se ejecuta el trade.',
      step6: 'Espera',
      step6Desc:
        'El agente espera al siguiente ciclo (intervalo fijo o sugerido por IA).',
      waitTitle: 'El tiempo de espera',
      agentMode: 'Modo AGENTE (por defecto)',
      agentModeDesc:
        'La IA sugiere un tiempo de espera basado en la volatilidad del mercado. Alta volatilidad = espera más corta (2-5 min). Baja volatilidad = espera más larga (10-30 min).',
      customMode: 'Modo PERSONALIZADO',
      customModeDesc:
        'Intervalo fijo establecido por el usuario (mínimo 5 minutos). La IA no ajusta la frecuencia.',
      outcomesTitle: 'Resultados de decisión',
      scenario: 'Escenario',
      decision: 'Decisión',
      confidence: 'Confianza',
      threshold: 'Umbral',
      result: 'Resultado',
      strongBuy: 'Señal de compra fuerte',
      executed: 'Trade ejecutado',
      executedProfit: 'Ejecutado (si min. beneficio cumplido)',
      weakBuy: 'Señal de compra débil',
      skipped: 'Omitido — por debajo del umbral',
      neutral: 'Mercado neutral',
      noAction: 'Sin acción — esperar',
      sellLoss: 'Venta con pérdida',
      sellProfit: 'Venta con ganancia',
      blocked: 'Bloqueado — nunca vende con pérdida vía LLM',
    },
    agentConfig: {
      title: 'Configuración de agentes',
      intro:
        'Configura los parámetros del agente, usa presets para una configuración rápida y entiende los conceptos clave detrás de cada ajuste.',
      presetsDesc:
        'CryptoTrader ofrece tres presets integrados que configuran todos los parámetros del agente a la vez. Elige según tu tolerancia al riesgo.',
      paramsTitle: 'Parámetros de configuración',
      paramsDesc:
        'Cada agente de trading tiene estos parámetros configurables. Haz clic en cada tarjeta para saber más.',
      conceptsTitle: 'Conceptos clave explicados',
    },
    tradeExecution: {
      title: 'Ejecución de trades',
      intro:
        'Cómo se ejecutan los trades, reglas de compra/venta, cálculos de comisiones y ejemplos reales.',
      buyTitle: 'Flujo de ejecución de compra',
      buyStep1:
        'Verificación de confianza — La confianza del agente debe superar el umbral de compra',
      buyStep2:
        'Verificación de capital — Confirmar balance suficiente (disponible × maxTradePct)',
      buyStep3:
        'Verificación de posiciones — Posiciones abiertas < maxConcurrentPositions',
      buyStep4:
        'Ejecutar orden — Orden de mercado en Binance (LIVE/TESTNET) o simular (SANDBOX)',
      buyStep5:
        'Crear posición — Registrar precio de entrada, cantidad y comisiones',
      sellTitle: 'Rutas de ejecución de venta',
      sellPath1: '1. VENTA recomendada por IA',
      sellPath1Desc:
        'El agente analiza el mercado y recomienda vender. Requiere: confianza > umbral de venta Y beneficio > minProfitPct (0.3%). NUNCA venderá con pérdida vía LLM.',
      sellPath2: '2. Activación de take-profit',
      sellPath2Desc:
        'Automático: cuando el precio sube por takeProfitPct desde la entrada. No requiere IA — se activa solo por precio.',
      sellPath3: '3. Activación de stop-loss',
      sellPath3Desc:
        'Automático: cuando el precio baja por stopLossPct desde la entrada. El único mecanismo que puede cerrar con pérdida. Límite de seguridad duro.',
      sellPath4: '4. Cierre manual',
      sellPath4Desc:
        'El usuario hace clic en "Cerrar Posición". Sin restricciones — puede cerrar a cualquier precio. Útil para salidas de emergencia.',
      priorityTitle: 'Prioridad de ejecución',
      priority: 'Prioridad',
      mechanism: 'Mecanismo',
      canLoss: '¿Puede cerrar con pérdida?',
      needsAI: '¿Requiere IA?',
      formulas: 'Fórmulas',
    },
    operationModes: {
      title: 'Modos de operación',
      intro:
        'CryptoTrader soporta tres modos de operación. Cada modo determina cómo se ejecutan los trades y si hay dinero real en riesgo.',
      overviewTitle: 'Resumen de modos',
      mode: 'Modo',
      exchange: 'Exchange',
      realMoney: '¿Dinero real?',
      useCase: 'Caso de uso',
      simulated: 'Simulado',
      sandboxUse: 'Aprendizaje, prueba de estrategias',
      testnetUse: 'Pruebas de integración API',
      liveUse: 'Trading real',
      sandboxTitle: 'Modo Sandbox',
      sandboxDesc:
        'Todos los trades se simulan en la base de datos. No se necesita conexión al exchange ni claves API. Perfecto para aprender y probar estrategias. Usa precios de mercado reales del WebSocket de Binance.',
      sandboxTip:
        'Comienza aquí para entender cómo funcionan los agentes, probar configuraciones y aprender la plataforma sin ningún riesgo.',
      sandboxTipTitle: 'Ideal para principiantes',
      testnetTitle: 'Modo Testnet',
      testnetDesc:
        'Se conecta al Testnet de Binance — un entorno separado con dinero ficticio. Las órdenes se colocan en una API de exchange real pero con fondos de prueba. Ideal para validar la configuración de claves API y la ejecución de órdenes sin riesgo.',
      testnetLimitations:
        'Los precios del Testnet pueden diferir de producción. La liquidez es limitada. Algunos pares pueden no estar disponibles.',
      testnetNote: 'Limitaciones del Testnet',
      liveTitle: 'Modo Live',
      liveDesc:
        'Trading con dinero real en Binance producción. Cada trade usa tu balance real. Requiere una cuenta Binance con fondos reales y claves API correctamente configuradas.',
      liveRisk:
        'El trading en vivo implica riesgo financiero real. Comienza con montos pequeños. La plataforma tiene protección stop-loss pero las pérdidas son posibles. Solo opera lo que puedes permitirte perder.',
      liveWarning: 'Advertencia de riesgo',
      switchingTitle: 'Cambiar entre modos',
    },
    binance: {
      title: 'Integración con Binance',
      intro:
        'Cómo CryptoTrader se integra con Binance para feeds de datos y ejecución de trades.',
      pairsTitle: 'Pares de trading soportados',
      pair: 'Par',
      base: 'Base',
      quote: 'Cotización',
      minOrder: 'Orden mínima',
      permissionsTitle: 'Permisos API requeridos',
      permission: 'Permiso',
      why: 'Por qué',
      sandbox: 'Sandbox',
      readInfo: 'Leer Info',
      readInfoWhy: 'Balance, historial de órdenes',
      notNeeded: 'No requerido',
      enableTrading: 'Habilitar Trading',
      enableTradingWhy: 'Colocar órdenes de compra/venta',
      noWithdrawal: 'Nunca habilites "Habilitar Retiros"',
      noWithdrawalDesc:
        'CryptoTrader nunca necesita permisos de retiro. Nunca los otorgues. Restringe tus claves por IP como capa adicional de protección.',
      pipelineTitle: 'Pipeline de datos',
      data: 'Dato',
      source: 'Fuente',
      frequency: 'Frecuencia',
      ohlcv: 'Velas OHLCV',
      realTime: 'Tiempo real',
      realTimePrice: 'Precio en tiempo real',
      every30s: 'Cada 30 segundos',
      perCycle: 'Por ciclo de análisis',
      accountBalance: 'Balance de cuenta',
      rateLimitsTitle: 'Límites de tasa',
      rateLimitsDesc:
        'Binance impone límites de tasa en el uso de la API. La plataforma los gestiona automáticamente:',
      rateLimitsCode: 'Límites de Binance',
    },
    apiKeys: {
      title: 'Claves API',
      intro:
        'Cómo generar, configurar y asegurar tus claves API para Binance y los proveedores LLM.',
      binanceTitle: 'Claves API de Binance',
      binanceStep1: 'Inicia sesión en tu cuenta Binance',
      binanceStep2: 'Ve a Gestión de API (Configuración → Gestión de API)',
      binanceStep3: 'Haz clic en "Crear API" — elige Sistema Generado',
      binanceStep4: 'Habilita SOLO "Leer Info" y "Habilitar Trading"',
      binanceStep4Desc: 'Nunca habilites Retiros ni Transferencia Universal',
      binanceStep5: 'Configura restricciones de IP para mayor seguridad',
      binanceStep6: 'Copia tanto la Clave API como la Clave Secreta',
      secretWarning: 'Clave secreta mostrada una sola vez',
      secretWarningDesc:
        'La Clave Secreta solo se muestra una vez al crear. Guárdala inmediatamente en un lugar seguro. Si se pierde, debes eliminar la clave y crear una nueva.',
      testnetTitle: 'Claves API de Testnet',
      testnetDesc:
        'Para el modo TESTNET, necesitas claves del Testnet de Binance — un entorno separado de producción.',
      testnetStep1: 'Ve a testnet.binance.vision',
      testnetStep1Desc: 'Esta es la Red de Prueba Spot de Binance',
      testnetStep2: 'Inicia sesión con tu cuenta de GitHub',
      testnetStep3: 'Generar Clave HMAC_SHA256',
      testnetStep4: 'Copia la Clave API y la Clave Secreta',
      testnetNote: 'Fondos de Testnet',
      llmTitle: 'Claves de proveedores LLM',
      llmDesc:
        'Cada proveedor LLM requiere su propia clave API. Se recomienda OpenRouter ya que da acceso a más de 300 modelos con una sola clave.',
      keyFormats: 'Formatos de clave por proveedor',
      securityTitle: 'Mejores prácticas de seguridad para claves',
      securityBestPractices: 'Mejores prácticas de seguridad',
      sec1: 'Nunca compartas tus claves API',
      sec2: 'Usa restricciones de IP en las claves de Binance',
      sec3: 'Nunca habilites permisos de retiro',
      sec4: 'Rota las claves periódicamente',
      sec5: 'Usa claves separadas para testnet y producción',
      sec6: 'Monitorea el uso de tu clave API de Binance en el dashboard de Binance',
    },
    llmProviders: {
      title: 'Proveedores LLM',
      intro:
        'CryptoTrader soporta 7 proveedores LLM. Cada agente puede usar un proveedor y modelo diferente.',
      supportedTitle: 'Proveedores soportados',
      provider: 'Proveedor',
      models: 'Modelos destacados',
      cost: 'Costo',
      notes: 'Notas',
      varies: 'Variable (opciones gratuitas)',
      openrouterNote: '300+ modelos, una sola clave API',
      openrouterDesc:
        'OpenRouter actúa como pasarela unificada a más de 300 modelos de múltiples proveedores. Una clave API te da acceso a modelos gratuitos (DeepSeek, Gemma, Qwen) y premium (GPT-4o, Claude).',
      paid: 'De pago',
      openaiNote: 'Máxima calidad, mayor costo',
      claudeNote: 'Excelente razonamiento',
      freeTier: 'Nivel gratuito',
      geminiNote: 'Buena opción gratuita',
      groqNote: 'Inferencia ultra-rápida',
      mistralNote: 'Proveedor europeo',
      togetherNote: 'Modelos de código abierto',
      best: 'Excelente',
      good: 'Buena',
      veryGood: 'Muy buena',
      freeFor: 'Pruebas, aprendizaje, bajo volumen',
      balancedFor: 'Trading regular, costo-efectivo',
      optimizedFor: 'Trading serio, máxima precisión',
      openrouterBenefit: '¿Por qué OpenRouter?',
      openrouterBenefitDesc:
        'Una sola clave API, presets de modelos (Gratis/Balanceado/Optimizado), asignación de modelos por agente y fallback automático si un modelo está caído.',
      validationTitle: 'Validación de modelos en vivo',
      validationDesc:
        'En Configuración → Agentes, cada modelo recomendado muestra un badge de validación (✓ Disponible / ⚠ Obsoleto) verificado contra el catálogo en vivo de OpenRouter. Haz clic en cualquier nombre de modelo para aplicarlo al instante.',
      presetsTitle: 'Presets de modelos',
      preset: 'Preset',
      quality: 'Calidad',
      bestFor: 'Ideal para',
      agentModelTitle: 'Mapeo agente-modelo',
      agentModelDesc:
        'No todos los agentes necesitan la misma calidad de modelo. El Enrutamiento de KRYPTO procesa clasificaciones simples — un modelo rápido y gratuito funciona bien. La Síntesis de KRYPTO toma la decisión final — se beneficia de un modelo de mayor calidad.',
      agent: 'Agente',
    },
    faq: {
      title: 'FAQ',
      intro: 'Preguntas frecuentes sobre CryptoTrader.',
      q1: '¿CryptoTrader es gratuito?',
      a1: 'La plataforma es gratuita. Solo pagas por el uso de la API LLM (opcional — modelos gratuitos disponibles via OpenRouter) y las comisiones de trading de Binance (0.1% por operación).',
      q2: '¿Puedo perder dinero?',
      a2: 'En modo SANDBOX — no. En modo LIVE — sí. Si bien la plataforma tiene protección stop-loss y nunca vende con pérdida vía IA, el stop-loss en sí puede y cerrará posiciones con pérdida para limitar el daño. Solo opera lo que puedes permitirte perder.',
      q3: '¿Qué exchanges están soportados?',
      a3: 'Actualmente solo Binance (trading Spot). El soporte para Binance Futures y otros exchanges está en el roadmap.',
      q4: '¿Qué criptomonedas puedo operar?',
      a4: 'BTC y ETH con USDT o USDC como monedas de cotización. Cuatro pares: BTCUSDT, BTCUSDC, ETHUSDT, ETHUSDC.',
      q5: '¿Cómo funciona el stop-loss?',
      a5: 'El stop-loss es un disyuntor duro. Cuando el precio baja el porcentaje configurado desde el precio de entrada, la posición se cierra inmediatamente — sin decisión de IA. Es el único mecanismo que puede cerrar con pérdida.',
      q6: '¿Puede la IA vender con pérdida?',
      a6: 'No. La IA (LLM) nunca vende con pérdida. Hay un umbral mínimo de rentabilidad (por defecto 0.3%) que debe superarse. Solo el stop-loss o el cierre manual pueden salir con pérdida.',
      q7: '¿Puedo ejecutar múltiples agentes simultáneamente?',
      a7: 'Sí. Cada agente opera de forma independiente con su propia configuración, par de trading y proveedor LLM. Puedes tener agentes en diferentes modos (ej. uno en SANDBOX, uno en LIVE).',
      q8: '¿Cuánto dura un ciclo de trading?',
      a8: 'Un ciclo de análisis tarda 10-30 segundos dependiendo de la velocidad del proveedor LLM. El intervalo entre ciclos es configurable (mínimo 5 minutos, o determinado por IA en modo AGENTE).',
      q9: '¿Están seguros mis datos?',
      a9: 'Las claves API están cifradas en reposo. Los datos de análisis de mercado se envían a los proveedores LLM pero nunca incluyen información personal ni datos de cuenta. La plataforma nunca tiene acceso para retirar fondos de tu cuenta del exchange.',
      q10: '¿Puedo auto-alojarlo?',
      a10: 'Sí. CryptoTrader es de código abierto. Puedes desplegarlo en tu propia infraestructura usando Docker. Consulta el README para las instrucciones de despliegue.',
      q11: '¿Qué ocurre si la plataforma se desconecta?',
      a11: 'Todos los agentes se detienen. Las posiciones abiertas permanecen abiertas en el exchange. El stop-loss es gestionado por la plataforma, no el exchange, por lo que no se activará mientras esté desconectada. Debes monitorear las posiciones y configurar stop-losses a nivel del exchange para operaciones críticas.',
      generalTitle: 'General',
      tradingTitle: 'Trading',
      technicalTitle: 'Técnico',
      moreHelp: '¿Necesitas más ayuda?',
      moreHelpDesc:
        'Si tu pregunta no está respondida aquí, usa el chat multi-agente para preguntar cualquier cosa sobre la plataforma. Los agentes de IA pueden proporcionar respuestas personalizadas basadas en tu configuración.',
    },
    dashboard: {
      title: 'Resumen del dashboard',
      intro:
        'La página de Resumen es tu centro de comando. Muestra el rendimiento de tu portafolio, PnL en tiempo real, distribución de activos y acceso rápido a todas las secciones de la plataforma.',
      kpiTitle: 'Métricas de rendimiento',
      kpiDesc:
        'La fila superior muestra cuatro métricas clave para el modo de operación actual. Todas las métricas se actualizan automáticamente a medida que los agentes ejecutan trades.',
      metric: 'Métrica',
      description: 'Descripción',
      source: 'Fuente',
      netPnl: 'PnL neto',
      netPnlDesc:
        'Ganancia/pérdida total tras comisiones en todas las posiciones cerradas',
      winRate: 'Tasa de acierto',
      winRateDesc: 'Porcentaje de posiciones cerradas con beneficio',
      openPositions: 'Posiciones abiertas',
      openPositionsDesc: 'Número de posiciones actualmente activas',
      totalTrades: 'Total de trades',
      totalTradesDesc:
        'Todas las órdenes de compra + venta ejecutadas en el modo actual',
      closedPositions: 'Posiciones cerradas',
      liveData: 'Datos en vivo',
      tradeHistory: 'Historial de trades',
      modeNote: 'Datos por modo',
      modeNoteDesc:
        'Todas las métricas reflejan solo el modo de operación actual (SANDBOX, TESTNET o LIVE). Cambiar de modo muestra conjuntos de datos separados. Usa el selector de modo en la navegación superior para cambiar.',
      pnlChartTitle: 'Gráfico de PnL en el tiempo',
      pnlChartDesc:
        'El gráfico de área muestra tu ganancia/pérdida neta acumulada en el tiempo. Cada punto representa un trade cerrado. Una línea ascendente significa actividad rentable; plana o descendente significa pérdidas o sin trades.',
      pnlChartTip: '¿Sin datos aún?',
      pnlChartTipDesc:
        'El gráfico solo aparece tras al menos un trade cerrado. Inicia un agente en modo SANDBOX, deja que complete al menos un ciclo completo COMPRA → VENTA y regresa para ver el gráfico.',
      assetTitle: 'Distribución de activos',
      assetDesc:
        'El gráfico de barras muestra el PnL desglosado por par de trading (BTCUSDT, BTCUSDC, ETHUSDT, ETHUSDC). Te permite comparar qué pares son más rentables para tu estrategia.',
      quickActionsTitle: 'Navegación rápida',
      quickActionsDesc:
        'El Resumen enlaza a todas las secciones clave. Usa la barra lateral para acceso rápido a Config. Agentes, Mercado, Posiciones y Log de Agentes.',
      section: 'Sección',
      path: 'Ruta',
      purpose: 'Propósito',
      marketPurpose: 'Precios en vivo, gráficos OHLCV, indicadores técnicos',
      botAnalysisPurpose: 'Puntuación técnica + noticias + agentes combinada',
      agentLogPurpose:
        'Revisar todas las decisiones de los agentes con razonamiento',
      positionsPurpose: 'Ver posiciones de trading abiertas y cerradas',
      configPurpose: 'Crear, iniciar, detener y gestionar agentes de trading',
      chatPurpose:
        'Preguntar a los agentes de IA cualquier cosa sobre la plataforma',
      balanceTitle: 'Visualización del balance',
      balanceDesc: 'El balance mostrado depende de tu modo de operación:',
      sandboxBalance: 'Balance Sandbox',
      sandboxBalanceDesc:
        'Billetera virtual que comienza en $10,000. Aumenta/disminuye a medida que los trades de sandbox se cierran. Se reinicia al cambiar de modo.',
      testnetBalance: 'Balance Testnet',
      testnetBalanceDesc:
        'Balance de tu cuenta Binance Testnet. Muestra USDT/USDC reales de fondos de prueba. Requiere claves API testnet configuradas en Configuración → Exchange.',
      liveBalance: 'Balance Live',
      liveBalanceDesc:
        'Balance real de Binance. Muestra USDT/USDC disponibles reales. Requiere claves API live. Este es dinero real.',
    },
    market: {
      title: 'Mercado y gráficos',
      intro:
        'La página de Mercado proporciona datos de precios en tiempo real, gráficos de velas OHLCV y un panel completo de análisis técnico para los cuatro pares de trading soportados.',
      tickerTitle: 'Ticker en vivo',
      tickerDesc:
        'En la parte superior de la página de Mercado, el ticker en vivo muestra datos de precios en tiempo real para el par seleccionado via WebSocket de Binance. Los datos se actualizan en milisegundos a medida que el mercado se mueve.',
      field: 'Campo',
      description: 'Descripción',
      currentPrice: 'Precio actual',
      currentPriceDesc:
        'Último precio operado, actualizado en tiempo real via WebSocket',
      priceChange: 'Cambio 24h',
      priceChangeDesc: 'Cambio de precio y porcentaje en las últimas 24 horas',
      high24h: 'Máximo 24h',
      high24hDesc: 'Precio más alto en las últimas 24 horas',
      low24h: 'Mínimo 24h',
      low24hDesc: 'Precio más bajo en las últimas 24 horas',
      volume: 'Volumen 24h',
      volumeDesc: 'Volumen total operado en 24 horas',
      pairTitle: 'Selector de par',
      pairDesc:
        'Usa los botones en la parte superior para cambiar entre los cuatro pares soportados. El gráfico, el ticker y los indicadores se actualizan para el par seleccionado.',
      chartTitle: 'Gráfico de precios',
      chartDesc:
        'La pestaña Gráfico muestra datos de velas OHLCV (Apertura, Máximo, Mínimo, Cierre, Volumen) para el par seleccionado. Las velas representan intervalos de 4 horas por defecto. Las barras de volumen aparecen debajo del gráfico de precios.',
      ohlcvNote: '¿Qué es OHLCV?',
      ohlcvDesc:
        'Cada vela muestra: Apertura (precio al inicio del período), Máximo (precio máximo), Mínimo (precio mínimo), Cierre (precio al final). Velas verdes = el precio subió; rojas = bajó.',
      indicatorsTitle: 'Indicadores técnicos',
      indicatorsDesc:
        'Cambia a la pestaña "Análisis Técnico" para ver todos los indicadores que los agentes de IA usan al tomar decisiones. Son exactamente los mismos indicadores enviados a SIGMA (analista de mercado) en cada ciclo.',
      indicator: 'Indicador',
      type: 'Tipo',
      signals: 'Señales',
      indicatorsTip: 'Cómo usa la IA los indicadores',
      indicatorsTipDesc:
        'SIGMA (analista de mercado) recibe todos los valores de indicadores y los interpreta de forma holística — no usa reglas codificadas como "RSI > 70 = vender". En su lugar, considera todas las señales junto con la acción del precio reciente y el volumen.',
      rsiSignals:
        '>70 sobrecomprado (posible venta), <30 sobrevendido (posible compra)',
      macdSignals:
        'Línea MACD cruzando por encima de la señal = alcista, por debajo = bajista',
      bbSignals:
        'Precio cerca de banda superior = sobrecomprado; cerca de inferior = sobrevendido',
      emaSignals: 'EMA corta cruzando por encima de EMA larga = señal alcista',
      stochSignals:
        'Combina RSI y estocástico para lecturas de momentum más precisas',
      volumeSignals:
        'Alto volumen confirma movimientos de precio; bajo volumen = señal débil',
      trend: 'Tendencia',
      momentum: 'Momentum',
      volatility: 'Volatilidad',
      movingAvg: 'Media móvil',
      volumeType: 'Volumen',
      analysisTitle: 'Del mercado a la decisión',
      analysisDesc:
        'Los datos técnicos de la página de Mercado alimentan directamente la página de Análisis del Bot, que los combina con el sentimiento de noticias e historial de agentes para producir una puntuación de confianza combinada.',
    },
    botAnalysis: {
      title: 'Análisis del bot',
      infoTitle: 'Para qué sirve esta página',
      infoDesc:
        'Usa Análisis del Bot para entender POR QUÉ el agente probablemente COMPRARÁ, VENDERÁ o MANTENDRÁ. Te da transparencia sobre el razonamiento de la IA antes de que ocurran las decisiones.',
      combinedScoreTitle: 'Banner de puntuación combinada',
      combinedScoreDesc:
        'El banner superior muestra una señal de mercado general (ALCISTA, BAJISTA o NEUTRAL) derivada de combinar indicadores técnicos y sentimiento de noticias. Es una señal informativa — no ejecuta trades directamente. La decisión final siempre la toman los agentes de IA.',
      techSummaryTitle: 'Resumen técnico',
      techSummaryDesc:
        'El panel de Resumen Técnico agrega todos los indicadores activos del par seleccionado en un veredicto legible. Cada indicador se muestra con su valor actual y una señal COMPRA/VENTA/NEUTRAL.',
      indicator: 'Indicador',
      value: 'Valor mostrado',
      signal: 'Señal',
      rsiValue: 'Valor numérico 0–100',
      rsiSignal: 'SOBRECOMPRADO / SOBREVENDIDO / NEUTRAL',
      macdValue: 'Línea MACD, línea de señal, histograma',
      macdSignal: 'ALCISTA / BAJISTA / NEUTRAL',
      bbValue: 'Posición banda superior/inferior',
      bbSignal: 'CERCA_SUPERIOR / CERCA_INFERIOR / NEUTRAL',
      volume: 'Volumen',
      volumeValue: 'Volumen 24h vs promedio',
      volumeSignal: 'ALTO / BAJO / NORMAL',
      emaValue: 'Estado de cruce EMA',
      emaSignal: 'ALCISTA / BAJISTA',
      newsSentimentTitle: 'Panel de sentimiento de noticias',
      newsSentimentDesc:
        'Este panel muestra el sentimiento de noticias recientes de criptomonedas y cómo se alinea con las señales técnicas. SIGMA procesa titulares para medir el estado de ánimo del mercado.',
      newsCount: 'Cantidad de noticias',
      newsCountDesc:
        'Cuántos artículos recientes están incluidos en el análisis',
      overallSentiment: 'Sentimiento general',
      overallSentimentDesc:
        'Puntuación de sentimiento agregada en noticias recientes (POSITIVO / NEGATIVO / NEUTRAL)',
      sigmaOpinion: 'Opinión de SIGMA',
      agentInputTitle: 'Resumen de aportes de agentes',
      agentInputDesc:
        'Esta sección muestra un resumen de las decisiones recientes de los agentes: conteos COMPRA/VENTA/MANTENER, confianza promedio y qué pares de trading son más activos.',
      element: 'Elemento',
      description: 'Descripción',
      nextDecisionTitle: 'Cuenta regresiva para próxima decisión',
      nextDecisionDesc:
        'Si algún agente está en ejecución, el banner de Próxima Decisión muestra una cuenta regresiva hasta cuándo el agente analizará el mercado.',
      nextDecisionTip: '¿Sin cuenta regresiva?',
      nextDecisionTipDesc:
        'La cuenta regresiva solo aparece cuando al menos un agente está activamente en ejecución. Ve a Config. Agentes, encuentra tu agente y haz clic en Play para iniciarlo.',
      pairSelectionTitle: 'Selección de par',
      pairSelectionDesc:
        'Usa el selector de par en la parte superior para cambiar entre BTCUSDT, BTCUSDC, ETHUSDT y ETHUSDC. El resumen técnico y el sentimiento de noticias se actualizan para reflejar el par seleccionado.',
    },
    agentDecisions: {
      title: 'Log de agentes',
      cardTitle: 'Anatomía de la tarjeta de decisión',
      cardDesc:
        'Cada entrada en el Log de Agentes es una tarjeta de decisión. Haz clic en cualquier tarjeta para expandir el razonamiento completo de la IA.',
      field: 'Campo',
      description: 'Descripción',
      decisionBadge: 'Badge de decisión',
      decisionBadgeDesc:
        'COMPRA (verde), VENTA (rojo) o MANTENER (gris) — la recomendación final',
      confidence: 'Confianza',
      confidenceDesc:
        'Puntuación del 0–100%. Cuán segura estaba la IA sobre su decisión',
      pair: 'Par de trading',
      pairDesc: 'El par de activos analizado (ej. BTC/USDT)',
      price: 'Precio en la decisión',
      priceDesc: 'Precio de mercado cuando se tomó la decisión',
      mode: 'Modo de operación',
      modeDesc:
        'SANDBOX, TESTNET o LIVE — en qué entorno estaba ejecutándose el agente',
      timestamp: 'Marca de tiempo',
      timestampDesc: 'Cuándo completó el ciclo de decisión',
      suggestedWait: 'Espera sugerida',
      suggestedWaitDesc:
        'Cuánto tiempo sugirió la IA esperar antes del próximo análisis (en modo AGENTE)',
      typesTitle: 'Entendiendo cada tipo de decisión',
      buyDesc:
        'El agente decidió comprar. Se ejecutó un trade SOLO SI: la confianza superó el umbral de compra Y el capital disponible ≥ tamaño mínimo de trade Y posiciones abiertas < máximo simultáneo.',
      sellDesc:
        'El agente decidió vender. Se ejecutó un trade SOLO SI: la confianza superó el umbral de venta Y el beneficio de la posición ≥ minProfitPct (0.3%). El agente nunca vende con pérdida.',
      holdDesc:
        'Sin acción. Las condiciones del mercado no cumplieron los criterios de COMPRA o VENTA. El agente esperará y re-analizará en el siguiente intervalo.',
      filtersTitle: 'Filtrar decisiones',
      filtersDesc:
        'Usa el panel de filtros para reducir el log de decisiones. Puedes filtrar por tipo de decisión, par de trading y qué agente produjo la decisión.',
      filter: 'Filtro',
      options: 'Opciones',
      decisionFilter: 'Tipo de decisión',
      assetFilter: 'Activo / Par',
      agentFilter: 'Agente',
      agentFilterDesc: 'TODOS o nombre de configuración de agente específico',
      detailTitle: 'Modal de detalle de decisión',
      detailTip: 'Leyendo el razonamiento',
      modeAwarenessTitle: 'Vista filtrada por modo',
      modeAwarenessDesc:
        'El Log de Agentes filtra automáticamente para mostrar solo las decisiones del modo de operación actual. Cambia entre SANDBOX, TESTNET y LIVE usando el selector de modo en la navegación superior.',
    },
    chat: {
      title: 'Chat multi-agente',
      intro:
        'La página de Chat te da acceso directo al sistema multi-agente para interacción conversacional. Haz preguntas sobre la plataforma, solicita análisis de mercado o pide explicaciones de decisiones recientes.',
      useCaseTitle: '¿Para qué usar el Chat?',
      useCaseDesc:
        'El Chat es ideal para: entender una decisión específica que tomó el agente, solicitar un análisis de mercado bajo demanda, aprender sobre las funciones de la plataforma o solucionar problemas de configuración.',
      sessionsTitle: 'Sesiones de chat',
      sessionsDesc:
        'Las conversaciones se organizan en sesiones. Cada sesión mantiene su propio contexto — la IA recuerda lo que se discutió dentro de una sesión. Puedes crear múltiples sesiones para mantener diferentes conversaciones separadas.',
      sessionStep1: 'Panel de sesiones',
      sessionStep1Desc:
        'La barra lateral izquierda (plegable en móvil) muestra todas tus sesiones. Haz clic en una para cargarla.',
      sessionStep2: 'Nueva sesión',
      sessionStep2Desc:
        'Escribir tu primer mensaje en un input vacío crea automáticamente una nueva sesión con el inicio de tu mensaje como título.',
      sessionStep3: 'Persistencia de sesión',
      sessionStep3Desc:
        'Las sesiones se guardan de forma permanente. Vuelve a cualquier conversación anterior para continuar el contexto.',
      capabilitiesTitle: 'Atajos de capacidad',
      capabilitiesDesc:
        'Sobre el campo de input, los botones de acción rápida inyectan contexto estructurado en tu mensaje automáticamente. Esto da a los agentes los datos que necesitan sin que tengas que describirlos.',
      capability: 'Capacidad',
      whatItDoes: 'Qué hace',
      bestFor: 'Ideal para',
      capAnalysis: 'Análisis de mercado',
      capAnalysisDesc:
        'Adjunta snapshot actual del mercado: precio, indicadores, velas recientes',
      capAnalysisFor:
        '"¿Por qué el agente compró?" o "¿Cómo está el mercado ahora?"',
      capNews: 'Análisis de noticias',
      capNewsDesc:
        'Adjunta titulares de noticias crypto recientes y sus puntuaciones de sentimiento',
      capNewsFor: '"¿Qué noticias mueven BTC hoy?" o análisis de sentimiento',
      capTrades: 'Historial de trades',
      capTradesDesc:
        'Adjunta decisiones recientes de los agentes y trades ejecutados',
      capTradesFor: '"Analiza mis últimos 10 trades" o revisión de estrategia',
      agentSelectionTitle: 'Elegir un agente',
      agentSelectionDesc:
        'Por defecto, NEXUS (el experto en plataforma) maneja las preguntas generales. Puedes cambiar a un agente específico usando el selector desplegable sobre el chat.',
      agent: 'Agente',
      bestAt: 'Mejor para preguntar sobre',
      nexusBest:
        'Funciones de la plataforma, configuración, cómo hacer preguntas',
      sigmaBest: 'Análisis de mercado, indicadores técnicos, acción del precio',
      forgeBest:
        'Ejecución de trades, gestión de órdenes, operaciones de portafolio',
      cipherBest: 'Datos blockchain, métricas on-chain, fundamentos crypto',
      aegisBest:
        'Gestión de riesgos, tamaño de posiciones, análisis de drawdown',
      orchestratingTitle: 'Indicador de orquestación',
      orchestratingDesc:
        'Cuando envías un mensaje complejo, puedes ver un indicador "Orquestando...". Esto significa que KRYPTO está enrutando tu solicitud al agente especialista más apropiado.',
      streamingNote: 'Respuestas en streaming',
      streamingNoteDesc:
        'Las respuestas se transmiten en tiempo real a medida que la IA las genera. Puedes ver el texto aparecer palabra por palabra. Para detener la respuesta antes, haz clic en el botón Detener.',
    },
    newsFeed: {
      title: 'Feed de noticias',
      intro:
        'La página de Feed de Noticias agrega titulares de noticias crypto, analiza su sentimiento y muestra cómo las noticias recientes se alinean con las condiciones del mercado.',
      summaryTitle: 'Tarjeta de resumen de análisis',
      summaryDesc:
        'En la parte superior del Feed de Noticias, la tarjeta de Resumen de Análisis muestra el sentimiento agregado de todos los titulares recientes. Distingue entre análisis basado en palabras clave (rápido, automático) y análisis con IA (más profundo, bajo demanda).',
      method: 'Método',
      description: 'Descripción',
      when: 'Cuándo se ejecuta',
      keywordAnalysis: 'Análisis de palabras clave',
      keywordDesc:
        'Coincidencia de patrones rápida en titulares usando palabras clave crypto predefinidas',
      keywordWhen: 'Automático, cada vez que las noticias se refrescan',
      aiAnalysis: 'Análisis con IA',
      aiDesc:
        'Análisis semántico más profundo usando un LLM para entender matices y contexto',
      aiWhen: 'Bajo demanda al hacer clic en "Ejecutar Análisis IA"',
      filtersTitle: 'Filtrar por sentimiento',
      cardTitle: 'Anatomía de la tarjeta de noticia',
      sigmaTitle: 'Conexión con SIGMA',
      sigmaTip: 'Badge de sentimiento de SIGMA',
      configTitle: 'Configurar noticias',
      configDesc:
        'Ve a Configuración → Noticias para configurar cuántos ítems de noticias se obtienen y muestran. El valor por defecto es 15 titulares.',
      configStep1: 'Navega a Configuración → Noticias',
      configStep2: 'Establece el número de ítems de noticias',
      configStep2Desc:
        'Rango: 5–50 ítems. Por defecto es 15. Valores más altos dan a SIGMA más contexto pero cada llamada de análisis IA será más grande.',
      configStep3: 'Guarda y regresa al Feed de Noticias',
      configStep3Desc:
        'La lista de noticias se refrescará con el nuevo conteo en la próxima carga.',
    },
    settingsAgents: {
      title: 'Configuración de modelos de agentes',
      intro:
        'La página Configuración → Agentes te permite configurar qué modelo LLM usa cada agente, aplicar presets inteligentes y ver la validación de modelos en tiempo real contra el catálogo de OpenRouter.',
      pathNote: 'Dónde encontrarlo',
      pathNoteDesc:
        'Navega a: Dashboard → Configuración → Agentes (barra lateral) o ve directamente a /dashboard/settings/agents',
      agentListTitle: 'Agentes configurables',
      agentListDesc:
        'Hay 7 roles de agentes. Cada uno puede asignarse con un proveedor LLM y modelo independiente. AEGIS (riesgo) está bloqueado — siempre usa el mismo modelo que la Síntesis de KRYPTO.',
      role: 'Rol',
      codename: 'Nombre clave',
      specialty: 'Especialidad',
      locked: '¿Bloqueado?',
      routingSpec: 'Enrutamiento de solicitudes',
      synthesisSpec: 'Síntesis de decisión final',
      platformSpec: 'Conocimiento de plataforma',
      operationsSpec: 'Ejecución de trades',
      marketSpec: 'Mercado e indicadores',
      blockchainSpec: 'Datos on-chain',
      riskSpec: 'Evaluación de riesgo',
      yes: '🔒 Sí',
      presetsTitle: 'Sistema de presets inteligentes',
      presetsDesc:
        'En lugar de configurar cada agente individualmente, usa un preset para asignar modelos óptimos a todos los agentes a la vez.',
      preset: 'Preset',
      strategy: 'Estrategia',
      cost: 'Costo estimado',
      freeStrategy: 'Asigna solo modelos $0 de OpenRouter',
      balancedStrategy: 'Asigna modelos costo-efectivos con buena calidad',
      optimizedStrategy: 'Asigna los mejores modelos para cada rol',
      presetRequires: 'Requiere OpenRouter',
      presetRequiresDesc:
        'Los presets están diseñados para OpenRouter. Asignan IDs de modelos específicos de OpenRouter por rol de agente.',
      recommendedTitle: 'Modelos recomendados (clic para aplicar)',
      recommendedDesc:
        'Cada tarjeta de agente muestra tres modelos recomendados (Gratis, Balanceado, Optimizado). Haz clic en cualquier nombre de modelo para aplicarlo instantáneamente.',
      badge: 'Badge',
      meaning: 'Significado',
      available: 'Disponible',
      availableDesc:
        'El modelo existe en el catálogo de OpenRouter — seguro para usar',
      deprecated: 'Obsoleto',
      deprecatedDesc:
        'Modelo no encontrado en el catálogo — puede haber sido eliminado. Haz clic en un modelo diferente.',
      deprecatedWarning: 'Si un modelo muestra Obsoleto',
      deprecatedWarningDesc:
        'OpenRouter ocasionalmente retira modelos. Si tu modelo asignado está obsoleto, el agente aún funcionará pero puede fallar.',
      perAgentTitle: 'Override de modelo por agente',
      perAgentDesc:
        'Cada tarjeta de agente tiene un selector de modelo. Para agentes OpenRouter, muestra un desplegable con búsqueda de todos los 300+ modelos disponibles.',
    },
  },
};

export default es;
