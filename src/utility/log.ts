export const log = (...args: any[]) => {
  if (__DEV__) {
    console.log('[MedicalApp]', ...args);
  }
};

export const logError = (...args: any[]) => {
  if (__DEV__) {
    console.error('[MedicalApp:Error]', ...args);
  }
};
