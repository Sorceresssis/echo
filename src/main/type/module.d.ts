// node-segment
declare module 'segment' {
    class Segment {
        constructor();
        useDefault(): void;
        doSegment(text: string, options: any): string[];
    }

    export = Segment;
}
