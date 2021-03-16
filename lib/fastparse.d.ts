
declare module 'fastparse' {
    class Parser<T = any> {
        constructor(description: any);

        parse(initialState: string, parsedString: string, context: T): T;
    }

    export = Parser;
}
