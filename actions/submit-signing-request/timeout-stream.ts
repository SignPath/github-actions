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
    private _timeout: NodeJS.Timeout | null = null;

    constructor(private options: TimeoutStreamOptions) {
        super();
        this._timeout = setTimeout(() =>
        {
            this.emit('timeout', new Error(this.options.errorMessage));
        }, this.options.timeoutMs);

        this.on('end', () => {
            if (this._timeout) {
                clearTimeout(this._timeout);
                this._timeout = null;
            }
        });
    }
}