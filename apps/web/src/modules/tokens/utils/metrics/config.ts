export const METRIC_WEIGHTS = {
  // === FATAL METRICS (Обнуляют Health Score) ===
  brokenReferences: 0,      // Fatal: несуществующие алиасы
  circularDependencies: 0,  // Fatal: А -> B -> A
  semanticDataErrors: 0,    // Fatal: пустые значения, кириллица или конфликты в семантике
  
  // === WARNING METRICS (В сумме дают 1.0) ===
  hardcoded: 0.3,           // 30% (Сырые значения вместо алиасов)
  orphans: 0.2,             // 20% (Токены, отсутствующие в некоторых темах)
  dataErrors: 0.15,         // 15% (Кириллица, пустые значения - в базовых токенах это Warning)
  unused: 0.1,              // 10% (Мертвый код)
  aliasDepth: 0.1,          // 10% (Слишком длинные цепочки)
  namingW3C: 0.1,           // 10% (Не по стандарту W3C)
  staticTokens: 0.05,       // 5%  (Одинаковые значения во всех модах)
};

export const THRESHOLDS = {
  unusedAllowancePct: 5, // 5% of primitives can be unused without penalty
  maxAliasDepth: 3,      // Max allowed alias depth
};
