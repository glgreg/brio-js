export declare class BrioLogger {
    #private;
    enabled: boolean;
    stackTrace: boolean;
    internalStackTrace: boolean;
    constructor(storeErrors: Set<number>, storeExceptions: Set<number>);
    out(type: "log" | "warn" | "info" | "error", message: string): void;
    fatalError(message: string): Error;
    error(errorId: number): void;
    exception(exceptionId: number): void;
}
//# sourceMappingURL=BrioLogger.d.ts.map