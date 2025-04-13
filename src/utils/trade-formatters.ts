export const formatAmount = (amount: number | undefined): string => {
  if (amount === undefined) return '-';
  return amount.toFixed(6);
};

export const formatPrice = (price: number | undefined): string => {
  if (price === undefined) return '-';
  return `$${price.toFixed(2)}`;
};

export const getTradeTimestampTooltip = (trade: Trade): string => {
  const timestamps = [];
  
  if (trade.createdAt) {
    timestamps.push(`Created: ${new Date(trade.createdAt).toLocaleString()}`);
  }
  if (trade.executedAt) {
    timestamps.push(`Executed: ${new Date(trade.executedAt).toLocaleString()}`);
  }
  if (trade.closedAt) {
    timestamps.push(`Closed: ${new Date(trade.closedAt).toLocaleString()}`);
  }
  
  return timestamps.join('\n');
};