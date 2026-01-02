export declare class BrioLogger {
    #private;
    static logsEnabled: boolean;
    static logsCallerEnabled: boolean;
    static logsCallerClassesEnabled: boolean;
    static get callerInfo(): string | undefined;
    static out(type: "log" | "warn" | "info" | "error", message: string): void;
    static fatalError(message: string): Error;
    static setErrorsStore(errorsSet: Set<number>): void;
    static setExceptionsStore(exceptionsSet: Set<number>): void;
    static error(errorId: number): void;
    static exception(exceptionId: number): void;
}
//# sourceMappingURL=BrioLogger.d.ts.map