export const formatCurrency = (amount: number | string | null | undefined): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount ?? 0;
  return `₹${num.toFixed(2)}`;
};

export const cleanErrorMessage = (error: any, fallback = 'Something went wrong'): string => {
  if (typeof error === 'string') return error;
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message) return error.message;
  return fallback;
};
