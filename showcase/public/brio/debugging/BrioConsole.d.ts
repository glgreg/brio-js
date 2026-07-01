export declare class BrioConsole {
    #private;
    /** If true, enables logs for this Brio Game instance */
    enabled: boolean;
    /** If true, enables stack traces for archives that are calling logs */
    showStackTrace: boolean;
    /** If true, enables stack traces in the Brio classes */
    showInternalStackTrace: boolean;
    get loggedErrors(): Set<string>;
    get stackTrace(): string;
    out(type: "log" | "warn" | "info" | "error", message: string): void;
    fatalError(message: string): Error;
    error(errorId: number): void;
    exception(exceptionId: number): void;
}
//# sourceMappingURL=BrioConsole.d.ts.map