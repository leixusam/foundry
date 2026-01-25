// Hardcoded configuration for v1
// Future: Read from .ralph.config.json or interactive setup
export const config = {
    workingDirectory: process.cwd(),
    gitBranch: 'main',
    staleTimeoutHours: 4,
    noWorkSleepMinutes: 5,
    errorSleepMinutes: 1,
};
export function getConfig() {
    return config;
}
//# sourceMappingURL=config.js.map