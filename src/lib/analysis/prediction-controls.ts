/** Prediction generation stays paused until the historical validation phase is complete. */
export const NBA_PREDICTIONS_ENABLED = process.env.NBA_PREDICTIONS_ENABLED === 'true';

export const NBA_PREDICTIONS_PAUSED_MESSAGE =
  'Palpites pausados enquanto concluímos a validação dos jogos reais de 20/10. A agenda continua disponível.';
