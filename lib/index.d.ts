declare type URI = string;
export default class Labeler {
    static store: Map<URI, string>;
    static history: Set<URI>;
    static proxy: string;
    static __(uri: URI, proxy?: string): Promise<string>;
    static prepopulate(obj: Record<URI, string>): void;
    static prefetch(urls: URI[], proxy?: string): Promise<void>;
    static all(urls: URI[], proxy?: string): Promise<string[]>;
}
export {};
