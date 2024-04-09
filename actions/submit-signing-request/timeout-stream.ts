// axious timeout des not cover a file downloading time
// to cover it we need to inject timeout check into the file streaming process
// https://github.com/axios/axios/issues/459

import { PassThrough, TransformCallback } from "stream";

export interface TimeoutStreamOptions
{
    timeoutMs: number;
    errorMessage: string;
}

export class TimeoutStream extends PassThrough  {
    private _timer: NodeJS.Timeout | null = null;

    constructor(private options: TimeoutStreamOptions) {
        super()
        console.log('TimeoutStream constructor')
        this.clear = this.clear.bind(this)
        this.on('end', this.clear)
    }

    _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback) {
        console.log('TimeoutStream _transform')
        if (this.options.timeoutMs > 0) {
            // clear existing timer
            this.clear()

            this._timer = setTimeout(() =>
            {
                console.log('TimeoutStream _transform timeout')
                this.emit('timeout', new Error(this.options.errorMessage));
            },
            this.options.timeoutMs);
        }

        callback(null, chunk)
    }

    clear() {
        console.log('TimeoutStream clear')
        if (this._timer) {
            console.log('TimeoutStream clear clearTimeout')
            clearTimeout(this._timer)
            this._timer = null;
        }
    }
}