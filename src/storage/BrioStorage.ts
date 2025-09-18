import { BrioGame } from "../BrioGame";

interface Storage {
	get state(): any;
    get session(): any;
	get local(): any;
	get db(): any;
}

export class BrioStorage {
	public static get state() {
        return {
            storeObject: 
        };
    }
    public static get session() {
        return {};
    }
    public static get local() {
        return {};
    }
    public static get db() {
        return {};
    }
}