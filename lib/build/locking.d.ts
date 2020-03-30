declare class Locking {
    static instance: undefined | Locking;
    private locked;
    static getInstance(): Locking;
    private addToLocked;
    isLocked: (key: string) => boolean;
    lock: (key: string) => Promise<void>;
    unlock: (key: string) => void;
}
export default function getLock(): Locking;
export {};
