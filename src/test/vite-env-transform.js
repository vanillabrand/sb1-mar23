module.exports = {
  process() {
    return {
      code: `
        const importMeta = {
          env: {
            VITE_DEEPSEEK_API_KEY: 'sk-d218e91b203f45ebb4ede94cbed76478',
            MODE: 'test',
            DEV: false,
            PROD: false,
            // Add other environment variables as needed
          }
        };
        export { importMeta as default };
      `
    };
  }
};