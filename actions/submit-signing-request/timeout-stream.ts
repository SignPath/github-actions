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
        super();
        this._timer = setTimeout(() =>
        {
            this.emit('timeout', new Error(this.options.errorMessage));
        }, this.options.timeoutMs);

        this.on('data', chunk => {
            this.emit('data', chunk);
        });
    }
}