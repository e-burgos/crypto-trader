const es = {
  nav: {
    dashboard: 'Panel',
    signIn: 'Iniciar sesión',
    getStarted: 'Comenzar',
    signOut: 'Cerrar sesión',
    help: 'Ayuda',
  },
  sidebar: {
    overview: 'Resumen',
    liveChart: 'Gráfico en Vivo',
    tradeHistory: 'Historial',
    agentLog: 'Registro del Agente',
    analytics: 'Análisis',
    market: 'Análisis de Mercado',
    config: 'Configuración',
    settings: 'Ajustes',
    positions: 'Posiciones',
    news: 'Noticias',
    chat: 'KRYPTO IA',
    admin: 'Admin',
    help: 'Ayuda y Guía',
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
    refresh: 'Actualizar ahora',
    loadError: 'Error al cargar datos de mercado. Verifica tu conexión.',
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
  },
  admin: {
    title: 'Panel de Administración',
    tabStats: 'Estadísticas y Resumen',
    tabUsers: 'Usuarios',
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
    buyThreshold: 'Umbral de Compra',
    sellThreshold: 'Umbral de Venta',
    stopLoss: 'Stop Loss %',
    takeProfit: 'Take Profit %',
    maxTrade: 'Máx. Trade %',
    maxConcurrent: 'Posiciones Concurrentes Máx.',
    minInterval: 'Intervalo Mínimo (min)',
    saveConfig: 'Guardar Configuración',
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
    tabProfile: 'Perfil',
    tabExchange: 'Exchange',
    tabAiModels: 'Modelos IA',
    tabNews: 'Noticias',
    profile: 'Perfil',
    email: 'Correo electrónico',
    password: 'Nueva Contraseña',
    saveProfile: 'Guardar Perfil',
    binanceKeys: 'Claves API de Binance',
    apiKey: 'Clave API',
    apiSecret: 'Secreto API',
    saveKeys: 'Guardar Claves',
    disconnectBinance: 'Desconectar',
    connected: 'Conectado',
    disconnected: 'No conectado',
    llmKeys: 'Claves API de LLM',
    provider: 'Proveedor',
    model: 'Modelo',
    remove: 'Eliminar',
    active: 'Activo',
    inactive: 'Inactivo',
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
  },
  notifications: {
    title: 'Notificaciones',
    markAllRead: 'Marcar todas como leídas',
    noNotifications: 'Sin notificaciones',
    justNow: 'Ahora mismo',
  },
  help: {
    title: 'Ayuda y Guía',
    subtitle: 'Todo lo que necesitas saber para operar en la plataforma',
    faq: 'Preguntas Frecuentes',
    guide: 'Cómo Operar — Paso a Paso',
    apiKeys: 'Configuración de Claves API',
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
        a: 'CryptoTrader es una plataforma que usa LLMs (Claude, OpenAI, Groq) para analizar el mercado y ejecutar operaciones automáticamente en tu cuenta de Binance. El agente lee datos del mercado, consulta al LLM para tomar una decisión y la ejecuta.',
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
        a: 'Actualmente Claude (Anthropic), OpenAI (GPT-4o) y Groq (LLaMA). Puedes usar cualquiera de ellos — cada uno necesita su propia clave API configurada en Ajustes.',
      },
      {
        q: '¿Qué pares de criptomonedas están soportados?',
        a: 'Actualmente BTC/USDT, BTC/USDC, ETH/USDT y ETH/USDC. Se podrían añadir más pares en versiones futuras.',
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
  },
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    loading: 'Cargando...',
    error: 'Algo salió mal',
    confirm: 'Confirmar',
    delete: 'Eliminar',
    edit: 'Editar',
    close: 'Cerrar',
    start: 'Iniciar',
    stop: 'Detener',
    status: 'Estado',
    role: 'Rol',
    actions: 'Acciones',
    empty: 'Sin elementos para mostrar',
    noData: 'Sin datos',
    afterFees: 'Después de comisiones',
    running: 'En ejecución',
    stopped: 'Detenido',
    pnl: 'G/P',
  },
  positions: {
    subtitle: 'Posiciones de trading actualmente abiertas',
    noPositionsHint:
      'Sin posiciones abiertas. Inicia un agente para comenzar a operar.',
    entryPrice: 'Precio de Entrada',
    opened: 'Apertura',
    openStatus: 'Abierta',
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
        '→ El agente evaluú el mercado como máximo una vez por hora',
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
        '60–120 min es ideal para la mayoría de estrategias. Intervalos cortos aumentan el costo de la API del LLM y exponen al agente al micro-ruido del mercado.',
      // Offset
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
  },
  notificationMessages: {
    agentNoLLM: 'Agente pausado: no hay credenciales LLM configuradas',
    agentError: 'Error del agente: {{message}}',
    tradeBuy: 'COMPRA {{qty}} {{asset}} @ ${{price}} ({{mode}})',
    stopLoss:
      'Stop-loss activado: VENTA {{qty}} {{asset}} @ ${{price}} | G/P: ${{pnl}}',
    takeProfit:
      'Take-profit activado: VENTA {{qty}} {{asset}} @ ${{price}} | G/P: ${{pnl}}',
  },
};

export default es;
