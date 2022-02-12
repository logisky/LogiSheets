export class BlurEvent<T> {
    constructor(
        public readonly text: string,
        public readonly bindingData?: T,
    ) {}
}
