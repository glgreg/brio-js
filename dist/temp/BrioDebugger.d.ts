import { CanvasFPSPosition } from "./BrioRender.js";
interface DebugConsoleProperties {
	/** logs padrão de estado e mostrar quais assets e objetos foram carregados, além de erros básicos */
	enabled: boolean;
	/** mostra a stack trace dos arquivos do usuario, para que encontre os locais onde cada ação ocorre via suas chamadas */
	showStackTrace: boolean;
	/** mostra a stack trace dos arquivos internos de Brio, para que caso o usuário precise entender o que está criando a lógica ao qual ele está usando (e possivelmente o motivo de seus erros) */
	showInternalStackTrace: boolean;
}
interface DebugGridProperties {
	enabled: boolean;
	width: number;
	height: number;
	/** mostra reguas no eixo x e y para o usuário saber onde buscar centralização */
	showAxisRulers: boolean;
}
interface DebugFPSOverlayProperties {
	enabled: boolean;
	position: CanvasFPSPosition;
	offset: number;
	size: number;
	backgroundColor: string;
	textColor: string;
}
interface DebugRenderProperties {
	grid: DebugGridProperties;
	showRenderBounds: boolean;
	showCollisionBounds: boolean;
	fpsOverlay: DebugFPSOverlayProperties;
}
export declare class BrioDebugger {
	#private;
	get console(): DebugConsoleProperties;
	get render(): DebugRenderProperties;
}
export {};
//# sourceMappingURL=BrioDebugger.d.ts.map
